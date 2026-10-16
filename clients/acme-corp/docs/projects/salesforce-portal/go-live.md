---
sidebar_position: 2
---

# Go-live checklist

Run through this the morning of the switch, in order. Each step is reversible until the last one.

1. **Confirm the package version** installed in production matches the one signed off in staging.
2. **Run Portal Setup** and confirm all seven checks report DONE.
3. **Assign the guest permission set** to the site's guest user.
4. **Invite one pilot user** and have them sign in from outside the office network.
5. **Switch the DNS record** to the live site.

:::caution Step 5 is the one that is hard to undo
DNS propagation means a mistake here is visible for up to an hour. Do steps 1 to 4 the day before.
:::
