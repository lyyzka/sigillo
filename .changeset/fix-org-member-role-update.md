---
'sigillo-app': patch
---

Fix changing a member role in the access table. Selecting Admin or Member now saves the new role instead of doing nothing.

The same bug also blocked removing a member from the table.

Fixes #5
