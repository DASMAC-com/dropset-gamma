---
name: init-pr
description: Create a placeholder PR from the current branch to warm CI caches.
disable-model-invocation: true
user-invocable: true
---

# `init-pr`

Create a placeholder PR on the current branch so CI
caches start warming while work continues.

## Steps

1. Get the current branch name:

   ```sh
   git branch --show-current
   ```

1. Extract the ticket ID from the branch name.
   The branch name follows the pattern `ENG-###`
   (possibly with a suffix). Use the `ENG-###`
   portion as the placeholder title.

1. Confirm there is no existing PR for this branch:

   ```sh
   gh pr list --head <branch> --json number
   ```

   If a PR already exists, print its URL and stop.

1. Push the branch if it has not been pushed yet:

   ```sh
   git push -u origin <branch>
   ```

1. Create a draft PR with the placeholder title
   and an empty body:

   ```sh
   gh pr create --draft \
     --title "<ENG-###>" \
     --body ""
   ```

1. Print the new PR URL.
