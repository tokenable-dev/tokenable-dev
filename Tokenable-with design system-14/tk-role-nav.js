/* tk-role-nav.js — intentionally inert.

   Partner status is an account flag (granted in Admin-Partners.html), NOT a
   separate login and NOT a separate navigation. Every account sees the same
   GNB: Markets / Portfolio / Sell.

   The partner-only difference lives inside the Sell flow: Sell.html offers a
   Partner vault / PSA vault choice to partner accounts, and sends regular
   accounts straight to the PSA submission flow (only one option, so no choice
   is forced).

   This file is kept as a no-op so the existing <script src="tk-role-nav.js">
   references across pages stay valid without 404s. */
