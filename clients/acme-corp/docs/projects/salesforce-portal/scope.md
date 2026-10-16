---
sidebar_position: 1
---

# Scope

What the portal does, in the order a user meets it.

## Signing in

Users sign in with an email address and a password that they set themselves from the invitation
email. There is no Salesforce licence behind a portal user, which is what keeps the per-seat cost
flat as the user count grows.

## What a user can reach

- **Records** for the objects switched on for their company
- **List views**, with the same filtering as the full Salesforce interface
- **Reports and dashboards**, read-only unless they are an administrator

## What is deliberately out

Anything that writes to a record a user does not own. Sharing is enforced server-side rather than
hidden in the interface, so a user who guesses a record id still gets nothing back.
