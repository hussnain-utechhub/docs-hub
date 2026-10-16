---
sidebar_position: 1
---

# Data migration

## Load order

Order matters because a child row cannot be loaded before its parent exists.

| Pass | Object | Depends on |
|---|---|---|
| 1 | Accounts | nothing |
| 2 | Contacts | Accounts |
| 3 | Opportunities | Accounts |
| 4 | Activities | Contacts, Opportunities |

## How a failed row is handled

Failures are written to a rejects file with the original row and the reason, and the load
continues. A pass is never rolled back on one bad row, because a 400,000-row load that stops at
row 12 wastes the window.
