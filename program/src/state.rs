use anchor_lang_v2::{
    accounts::Slab,
    address_eq,
    bytemuck::{Pod, Zeroable},
    prelude::*,
};

pub type FeeRate = u16;

pub const MAX_REGISTRY_ADMINS: usize = 3;
pub const MAX_REGISTRY_MAKERS: usize = 20;
pub const DEFAULT_MAX_SEATS_PER_MARKET: u8 = 10;

/// Index into the Registry slab's tail. `NULL` (= u8::MAX) marks "no link".
#[derive(Clone, Copy, Pod, Zeroable, IdlType, PartialEq, Eq, Debug)]
#[bytemuck(crate = "anchor_lang_v2::bytemuck")]
#[repr(transparent)]
pub struct EntryIndex(pub u8);

impl EntryIndex {
    pub const NULL: Self = Self(u8::MAX);
    pub fn is_null(self) -> bool {
        self == Self::NULL
    }
}

#[account]
pub struct RegistryHeader {
    pub default_taker_fee_rate: FeeRate,
    pub max_seats_per_market: u8,
    pub bump: u8,
    pub admin_head: EntryIndex,
    pub admin_tail: EntryIndex,
    pub n_admins: u8,
    pub maker_head: EntryIndex,
    pub maker_tail: EntryIndex,
    pub n_makers: u8,
    pub free_head: EntryIndex,
    pub _pad: [u8; 1],
}

#[derive(Clone, Copy, Pod, Zeroable, IdlType, PartialEq, Eq, Debug)]
#[bytemuck(crate = "anchor_lang_v2::bytemuck")]
#[repr(C)]
pub struct RegistryEntry {
    /// On free list: `Address::default()` is the emptiness sentinel.
    pub account: Address,
    /// Unused on free list.
    pub prev: EntryIndex,
    /// On free list: links to next free sector. NULL = end of list.
    pub next: EntryIndex,
    pub _pad: [u8; 6],
}

pub type Registry = Slab<RegistryHeader, RegistryEntry>;

pub trait RegistryExt {
    fn is_admin(&self, addr: &Address) -> bool;
    fn is_maker(&self, addr: &Address) -> bool;
}

impl RegistryExt for Registry {
    fn is_admin(&self, addr: &Address) -> bool {
        walk_dll(self, self.admin_head).any(|e| address_eq(&e.account, addr))
    }
    fn is_maker(&self, addr: &Address) -> bool {
        walk_dll(self, self.maker_head).any(|e| address_eq(&e.account, addr))
    }
}

fn walk_dll<'a>(
    reg: &'a Registry,
    head: EntryIndex,
) -> impl Iterator<Item = &'a RegistryEntry> + 'a {
    let mut cur = head;
    core::iter::from_fn(move || {
        if cur.is_null() {
            return None;
        }
        let entry = reg.get(cur.0 as usize)?;
        cur = entry.next;
        Some(entry)
    })
}
