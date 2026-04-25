# Ephemeral Central Limit Order Book (eCLOB) Architecture

This sketch presents an ephemeral central limit order book (eCLOB) design that
transparently aggregates liquidity from multiple market makers into a
single Solana account. The eCLOB provides a familiar order book API for makers,
transparency for takers and aggregators, and price update costs as low as a
propAMM. It synthesizes the benefits of two major existing designs, while
eliminating their respective drawbacks:

**Legacy CLOBs** offer a consolidated, transparent book that takers and
aggregators can query in one place, but the entire book must be kept
fully-sorted in memory onchain, typically via binary search trees, and
re-sorted on every maker quote update. Maintenance costs fall on makers
regardless of whether a taker ever trades against their re-shuffled liquidity,
making frequent re-quoting prohibitively expensive for active strategies.

**propAMMs** sit at the opposite extreme: a lazy-loading design where each maker
rapidly updates a single reference price in an isolated account. Quoting is
cheap, but liquidity is fragmented across opaque venues where a fill can
silently execute at a price different from what was quoted. Without a shared
book and common data model, takers and aggregators face difficulties detecting
such discrepancies or routing around them.

The eCLOB design collapses both tradeoffs. Because every maker quotes into
the same visible book, takers and aggregators hit a single account and compare
all competing prices at once; worst-case slippage is bounded by the next-best
visible level rather than whatever price one isolated venue chose to show.

The key innovation is **just-in-time order book reconstruction** (detailed
below): rather than maintaining a persistent sorted structure onchain, each
taker builds an ephemeral book on the SVM program heap for the duration of
their instruction, then discards it. Book-maintenance cost shifts onto
takers — makers never pay to keep a shared sorted structure coherent.

This design enables the same lazy-loading approach to price updates that
propAMMs use, made possible here by segmenting the market-maker set into
a bounded pool of allowlisted seats. N makers share one market account,
and each hot-path price update is just a few aligned memory stores, enabling
propAMM-cadence reference-price refresh through a familiar CLOB-style API,
but without propAMM opacity or engineering burden.

## Seat

A **seat** holds a maker's inventory, their `BookProfile` (bids and asks as
offsets from a single reference price), and a `ReferencePrice` they update on
the hot path. Seats live contiguously inside a shared market account (see
`MarketHeader` below).

Maker-supplied prices are **not** validated on write — takers range-check
at match time, so a nonsense reference price just renders that seat unmatchable.

Every quote gets a unique, monotonically increasing identifier drawn
from `market.nonce` — a global counter incremented on every
`SetReferencePrice` (and every taker fill). At match time, quotes at
the same price are ranked by nonce: lower nonce = earlier arrival =
wins. This is the canonical CLOB **price-time priority** rule, with
the nonce standing in for "time" — slot timestamps would be too
coarse, since multiple quotes can land in the same slot.

```rust
struct Seat {
    maker: Pubkey,
    /// Packed `(stamp, price, expiry)`. Hot path —
    /// overwritten as two aligned u64 stores.
    reference_price: ReferencePrice,
    /// Base tokens (atoms) available to back this seat's asks.
    base_atoms: u64,
    /// Quote tokens (atoms) available to back this seat's bids.
    quote_atoms: u64,
    /// Next seat in the active DLL, or next free sector when this
    /// seat is on the free list.
    next: *mut Seat,
    /// Previous seat in the active DLL (unused on the free list).
    prev: *mut Seat,
    /// Bids and asks expressed as offsets from
    /// `reference_price.price`.
    profile: BookProfile,
    /// Per-level fill allowance in base atoms, mirroring
    /// `profile`'s `(bids, asks)` shape. Flushed from `profile`
    /// sizes by the first taker to match this seat after a
    /// `SetReferencePrice` — see `reference_price.stamp`.
    remaining: Remaining,
}

struct ReferencePrice {
    /// `market.nonce` stamped at the last `SetReferencePrice`,
    /// OR'd with `FLUSH_BIT` (`1 << 63`) as a "flush pending"
    /// flag. Low 63 bits break ties for price-time priority at
    /// match time — takers mask off `FLUSH_BIT` before
    /// comparing. The first taker to match this seat copies
    /// `BookProfile` sizes into `Seat.remaining` and clears the
    /// flag.
    stamp: u64,
    /// Reference price for this maker's book profile.
    /// Custom 32-bit representation; range-checked by the taker
    /// at match time.
    price: Price,
    /// Slot after which this reference price is no longer valid
    /// (low 32 bits of `Clock::slot`, supplied by the maker).
    /// Expired quotes are skipped by takers at match time.
    expiry: u32,
}

struct Remaining {
    /// Live bid-side allowance, refilled from
    /// `BookProfile.bids[i].size` on flush.
    bids: [u64; N_LEVELS],
    /// Live ask-side allowance, refilled from
    /// `BookProfile.asks[i].size` on flush.
    asks: [u64; N_LEVELS],
}
```

## BookProfile

Bids and asks are stored as **offsets from the reference price**, not
absolute prices, and materialized at match time by adding each offset to
`reference_price.price`. This keeps the onchain representation compatible
with standard batch-replace APIs — a maker desk's usual bid/ask ladder
translates directly into a `BookProfile` by subtracting each level's
absolute price from the reference.

Each level's `size` is a **per-refresh allowance**, not a standing
quantity. Live availability is tracked in `Seat.remaining`, which the
first post-refresh taker refills from `BookProfile` sizes (triggered
by the `FLUSH_BIT` on `reference_price.stamp`). A single refresh can
therefore be hit for at most `size` per level no matter how many
separate takes arrive before the maker next calls `SetReferencePrice`.

```rust
struct BookProfile {
    /// Bid levels, top of book first.
    bids: [Level; N_LEVELS],
    /// Ask levels, top of book first.
    asks: [Level; N_LEVELS],
}

struct Level {
    /// Unsigned offset from reference price, as a custom 32-bit
    /// decimal representation. Direction is implicit: subtract
    /// for bids, add for asks.
    offset: PriceOffset,
    /// Fill allowance at this level in base atoms, reset per
    /// `SetReferencePrice` refresh. Live per-level availability
    /// is tracked in `Seat.remaining`.
    size: u64,
}
```

## MarketHeader

The `MarketHeader` is a fixed-size record at the front of the market account:

```rust
struct MarketHeader {
    /// Market-wide monotonic counter. Stamped onto the seat on every
    /// `SetReferencePrice`; also advanced on every taker fill. A `u64`, wide
    /// enough to never wrap over the market's lifetime.
    nonce: u64,
    /// Head of the active-seat doubly linked list, or null if empty.
    head: *mut Seat,
    /// Head of the free-seat list, or null if none to reuse.
    free_head: *mut Seat,
    /// Taker fee rate. `FeeRate` is a `u16` in hundredths of a basis point
    /// (100 units = 1 bp), capping the fee at ~6.55%. Mutable by an admin.
    taker_fee_rate: FeeRate,

    // Pubkeys and bumps.
    base_mint: Pubkey,
    quote_mint: Pubkey,
    base_vault: Pubkey,
    quote_vault: Pubkey,
    bump: u8,
    base_vault_bump: u8,
    quote_vault_bump: u8,
}
```

The market account's data begins with a `MarketHeader` followed by a
contiguous array of fixed-size `Seat` sectors. Seats are allocated on
demand: when a new maker is seated, the account is `realloc`'d by
`size_of::<Seat>()` (or a sector is pulled off the free list if one is
available). Market creation only pays rent for the header.

`MarketHeader` stores absolute SVM pointers (`head`, `free_head`) into
the seat region that remain valid across transactions (see below for
input buffer details).

Contiguous memory layout — one slab, grown by `realloc` only:

```txt
+----------------+----------+----------+----------+----------+-----+
| MarketHeader   | Sector 0 | Sector 1 | Sector 2 | Sector 3 | ... |
+----------------+----------+----------+----------+----------+-----+
```

Two logical lists are threaded through the same sectors via each
seat's `next`/`prev` pointers. Active seats form a doubly linked
list; vacated sectors form a singly linked free list. Example state
after opening Seats 0–3 and then closing Seat 1:

```txt
  MarketHeader
  +---------------+
  | head      ----+---> Seat 3 <-> Seat 2 <-> Seat 0 -> null
  | free_head ----+---> Seat 1 -> null
  +---------------+
```

New seats are prepended at `head` (so `Seat 3` — the most recent open
— sits at the front). `free_head` points at the most recently vacated
sector; the free list is singly linked via `next` and ignores `prev`.
Both lists are mutated only on seat open/close — the hot path
(`SetReferencePrice`) never touches list pointers.

## Registry

Makers are allowlisted, not permissionless. The effective cap on seats per
market is set by the cost to reconstruct the ephemeral order book during each
take (detailed below), and can be tuned across the protocol's lifecycle as CU
budgets and runtime performance evolve. Note that if the allowlist ever becomes
a bottleneck on market access, the protocol will have already proven its merit.
In other words, it's a good problem to have if ten makers are quoting and an
eleventh wants in.

The `Registry` is a global singleton account that holds:

- the set of pubkeys permitted to hold seats and quote on any market
  (checked at `OpenSeat`, not on the hot path, to preserve the
  minimal hot-path write cost of `SetReferencePrice`),
- the set of admin pubkeys (the only signers allowed to change
  `taker_fee_rate` on any market or to mutate the `Registry`),
- governance defaults applied at market creation
  (`default_taker_fee_rate`) and enforced globally
  (`max_seats_per_market`).

```rust
struct Registry {
    /// Hard cap on how many seats any one market may allocate
    /// (up to 255). Enforced at `OpenSeat` time on the Grow path.
    max_seats_per_market: u8,
    /// Taker fee rate stamped into `MarketHeader.taker_fee_rate`
    /// at market creation. Admins may change a market's fee
    /// later; this field only sets the initial value.
    default_taker_fee_rate: FeeRate,
    /// Admins authorized to mutate per-market fee rates.
    admins: [Pubkey; N_ADMINS],
    /// Makers authorized to hold seats.
    makers: [Pubkey; N_MAKERS],
}
```

## Maker operations

A maker joins a market by calling `OpenSeat` to claim a seat, then
`SetBookProfile` to lay down their bid/ask ladder as offsets from a reference
price. From there, steady-state activity is just `SetReferencePrice` on the
hot path — sliding the whole ladder by updating a single anchor price.
`SetBookProfile` can be re-called to reshape the ladder as needed.

### Authority & pointer validation

Maker instructions pass a pointer into the market account's data
region pointing directly at their seat, avoiding any list walk.
Before mutating the seat, the program performs three checks:

1. **Bounds.** `ptr` lies within the market account's data region
   after the header and before the end of allocated data
   (i.e. `seats_start <= ptr < account_data_end`, where
   `seats_start = account_data_base + size_of::<MarketHeader>()`).
1. **Alignment.** `(ptr - seats_start) % size_of::<Seat>() == 0` —
   guarantees the pointer lands on a real seat boundary, so the
   cast to `&mut Seat` is well-formed.
1. **Authority.** `seat.maker == signer`.

No discriminant tag is needed: the seat region is homogeneous, so
(1) + (2) fully determine that `ptr` refers to a valid `Seat`. The
`maker` field doubles as an emptiness marker — `Pubkey::default()`
means "on the free list / unassigned," and updates against such
seats are rejected by (3).

**Zero-data maker accounts.** The pointer scheme assumes the market
account's data region starts at a known offset in the transaction's
input memory map. For this to hold under static addressing, the
maker's signer account must carry **zero account data** — any
variable-size payload on the maker account would shift downstream
offsets and break direct addressing.

Simplified input buffer schematic:

```txt
+---------------+-------------------+----------------+
| n_accounts    | Maker account     | Market account |
| (u64)         | (signer, 0 data)  |                |
+---------------+-------------------+----------------+
                                    ^
                                    |
                             fixed offset
```

### OpenSeat

Called by a new maker (must appear in `Registry`) to claim a seat.
Two paths, tried in order:

1. **Reuse.** If `free_head != null`, pop that sector and initialize
   it.
1. **Grow.** Otherwise, if the current number of allocated sectors is
   below `registry.max_seats_per_market`, `realloc` the account by
   `size_of::<Seat>()` and use the new tail sector. The caller pays
   the rent delta. If the cap is already reached, `OpenSeat` fails
   and the maker must wait for a free sector.

In both cases, the sector is prepended at `head` — O(1), no list walk.

### SetBookProfile

Setup path. Writes the full `BookProfile` — all orders are
expressed relative to a single reference price, so the profile itself
is price-agnostic. Called on seat init and when the maker wants to
reshape their book. Also sets `FLUSH_BIT` on `reference_price.stamp`
with a single `u64` store, so the next taker copies the new sizes into
`Seat.remaining` instead of reusing stale per-level allowances from the
old profile.

### SetReferencePrice

Hot path. Reads `market.nonce`, writes `Seat.reference_price`
(two aligned `u64` stores: one for `market.nonce | FLUSH_BIT`
as `stamp`, one packing `(price, expiry)`), and increments
`market.nonce`. Setting `FLUSH_BIT` on `stamp` arms a pending
refill of `Seat.remaining`, deferred to the next taker — so the
maker write stays at two stores regardless of `N_LEVELS`. No seat
iteration, no reallocations, no profile touch — asm-optimized,
analogous to a propAMM reference-price update.

## Order matching

There is no persistent order book account. Each take builds a fresh
**ephemeral book** on the SVM program heap, uses it to fill the taker,
and discards it when the instruction returns. Orders are materialized
just-in-time from each seat's `(reference_price.price, profile)` —
each level's absolute price is `reference_price.price + level.offset`
(subtract for bids, add for asks). Makers only pay for cheap
reference-price updates between takes.

### Book construction

On every taker instruction:

1. **Walk** the active-seat doubly linked list from `head`.
1. **Range-check** the seat's `reference_price.price`. Drop the
   seat entirely if out-of-range (this is the deferred
   validation from the maker's hot path — a nonsense price
   renders the seat unmatchable here).
1. **Flush if armed.** If `FLUSH_BIT` is set on
   `reference_price.stamp`, copy `BookProfile` sizes into
   `Seat.remaining` and clear the bit with one `u64` store.
1. Iterate the relevant side of `profile` (asks for a buy
   taker, bids for a sell taker), adding `level.offset` to
   `reference_price.price` to get each absolute price.
1. **Push** each
   `(price, remaining.<side>[i], stamp & !FLUSH_BIT, seat_ptr, level_idx)`
   tuple onto a binary heap allocated on the program heap,
   skipping levels where the side's `remaining` is `0`. The heap is keyed
   by `(price, nonce)`: min-heap for asks, max-heap for bids.
   Nonce breaks price ties (older = wins) — `FLUSH_BIT` is
   masked off the stamp so a just-flushed seat doesn't sort
   younger than a previously-flushed one with the same
   underlying counter value.
1. **Pop** from the heap and fill the taker: decrement the taker's
   remaining size, decrement the popped level's
   `Seat.remaining.<side>[i]`, debit the seat's `base_atoms` /
   `quote_atoms`, and accrue the taker fee from
   `market.taker_fee_rate`. Continue until the taker is filled, the
   next heap top exceeds the taker's limit price, or the heap is
   drained.
1. **Tear down.** The heap buffer is freed with the transaction;
   debited inventory, `Seat.remaining` decrements, the cleared
   `FLUSH_BIT` on any flushed seat, and `market.nonce` persist
   to chain. Takers bump `market.nonce` per fill but never touch
   `reference_price.stamp` beyond clearing `FLUSH_BIT`.

### Crossed maker quotes

The protocol **does not** auto-match makers against each other. If
Maker A's ask drifts below Maker B's bid (e.g. because A just
`SetReferencePrice`'d without observing B), nothing happens on
chain until the next taker arrives. A crossed book is an arbitrage
opportunity — any taker can profit from it — which gives makers a
standing incentive to keep their reference prices honest without
the matching engine needing a maker-vs-maker pre-pass.
