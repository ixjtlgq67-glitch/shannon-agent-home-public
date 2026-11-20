# Ownership and review setup

| Pod | Accountable human | GitHub reviewer |
| --- | --- | --- |
| Signal / platform & integration | Guillermo Ravelo | @br-collab (invitation pending acceptance) |
| Surface | Sneha Sudharsan | Awaiting confirmed username |
| Output | Carlos del Rosario | Awaiting confirmed username |
| Ledger / repository custodian | Qi Liu | @ixjtlgq67-glitch |

Qi confirmed Guillermo's GitHub username as `br-collab`. An invitation grants contributor (write) access so he can participate in code review; Guillermo must accept it. CODEOWNERS routes Signal/build/product and platform paths to him and the custodian. Other paths temporarily route to the repository custodian, not a replacement for the pod owners. Confirm Sneha's and Carlos's GitHub usernames later and add them as collaborators before replacing their routing rules. GitHub code owners need write access. Never infer accounts from names or emails.

Main requires pull requests, one approval, resolved conversations and the `validate` check. Repository administrators retain an emergency bypass so the sole current collaborator is not permanently locked out. This is recorded as a bootstrap limitation; teammates' reviewer routing awaits their usernames.

Use `pod/signal`, `pod/surface`, `pod/output` and `pod/ledger` branches. Database changes need a specifically designated schema owner (pending team confirmation; platform owner coordinates).
