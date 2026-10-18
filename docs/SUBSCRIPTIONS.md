# Club subscriptions: setting them up

Clubs pay for their plan (`lib/billing.ts`) in either of two ways, and both end
up in the same place:

- **In the App Store app**, with In-App Purchase (Apple bills it; Apple keeps
  15% on the Small Business Program).
- **On the website**, by card or Apple Pay through Stripe (RevenueCat Web
  Billing).

RevenueCat keeps every subscription. Each club is one RevenueCat customer,
`club:<club id>`, whoever pays. When anything changes, RevenueCat calls the
hub's webhook (`/api/billing/revenuecat`), the hub reads the club's
subscription back from RevenueCat, and saves its plan and paid-up-to date on
the club (`lib/revenuecat.ts`). That's what pauses a club when its trial or
subscription ends, and unpauses it when it pays. The Plans page also checks
RevenueCat whenever a club admin opens it.

A plan set by hand in platform admin is kept while it runs longer than any
store subscription. Founding clubs and clubs marked free are never charged.

## 1. App Store Connect (In-App Purchase)

1. **Agreements, Tax and Banking**: accept the **Paid Apps** agreement and add
   your bank account and tax forms. Purchases can't be tested until it's
   active.
2. Join the **App Store Small Business Program** (developer.apple.com →
   Programs) for the 15% rate.
3. Your app → **Monetization → Subscriptions** → create one subscription group,
   e.g. "Club plan", with six subscriptions, ranked Large Club (top) to Starter:

   | Product ID | Name | Duration | Price |
   | --- | --- | --- | --- |
   | `uk.co.grassrootsclubhub.large.monthly` | Large Club (monthly) | 1 month | £14.99 |
   | `uk.co.grassrootsclubhub.large.yearly` | Large Club (yearly) | 1 year | £149.99 |
   | `uk.co.grassrootsclubhub.club.monthly` | Club (monthly) | 1 month | £9.99 |
   | `uk.co.grassrootsclubhub.club.yearly` | Club (yearly) | 1 year | £99.99 |
   | `uk.co.grassrootsclubhub.starter.monthly` | Starter (monthly) | 1 month | £4.99 |
   | `uk.co.grassrootsclubhub.starter.yearly` | Starter (yearly) | 1 year | £49.99 |

   The hub works out the plan from the end of the product ID
   (`.<starter|club|large>.<monthly|yearly>`), so keep that ending. Clubs
   already get a 30-day free trial from the hub, so don't add an Apple free
   trial on top.
4. **Users and Access → Integrations → In-App Purchase**: create an In-App
   Purchase key and download the `.p8` file (RevenueCat needs it).

## 2. Stripe (website payments)

Create a Stripe account (stripe.com) and complete its business details. You
don't create products in Stripe: RevenueCat does that.

## 3. RevenueCat

1. Create an account at revenuecat.com and a **project** ("Grassroots Club Hub").
2. **Apps**: add the **App Store** app (bundle ID `uk.co.grassrootsclubhub.app`)
   with the In-App Purchase key from step 1.4. Then add **Web Billing**
   and connect your Stripe account.
3. **Products**: import the six App Store products. In Web Billing, create the
   same six with the same endings, e.g. `web.club.monthly` at £9.99.
4. **Entitlements**: one entitlement, `club`, with all twelve products attached.
5. **Offerings**: a `default` offering with a package for each plan and period,
   holding both its App Store and its Web Billing product.
6. **Web Purchase Link** (Web Billing → Purchase links): create one for the
   `default` offering. Set its success redirect to
   `https://grassroots-club-hub.co.uk/start` (signed-in admins see their club
   there). Copy the link's address, **without** any customer ID on the end.
7. **Integrations → Webhooks**: add
   `https://grassroots-club-hub.co.uk/api/billing/revenuecat`, and make up a
   long random value for the **Authorization header**
   (e.g. `Bearer` followed by 40 random characters).
8. **API keys**: copy the **secret** API key (starts `sk_`). Also note the
   **Apple public SDK key** (starts `appl_`); the App Store app will need it.

## 4. Render

In the web service's **Environment**, add:

| Key | Value |
| --- | --- |
| `REVENUECAT_SECRET_KEY` | the secret API key (step 3.8) |
| `REVENUECAT_WEBHOOK_AUTH` | exactly the Authorization value from step 3.7 |
| `REVENUECAT_WEB_PURCHASE_URL` | the Web Purchase Link from step 3.6 |

Once they're set, a club admin sees a **Subscribe** button on the club's
**Plans** page, and a paid club shows how it pays (and **Manage Billing** for
web payments).

## 5. Testing

- **Website:** in RevenueCat, use Web Billing's sandbox mode with Stripe's test
  cards (4242 4242 4242 4242). Subscribe from a test club's Plans page, then
  check the club shows as paid there and in platform admin.
- **App:** sandbox testers (App Store Connect → Users and Access → Sandbox)
  buy on a real iPhone; sandbox subscriptions renew every few minutes, so you
  can watch renewals and expiry pause and unpause the test club.

## Still to do

- **The in-app plans screen**: the RevenueCat plugin in `ios-app/`, a plans
  screen for club admins (and only them) inside the app, and **Restore
  Purchases**. Purchases are made as the club's customer, `club:<club id>`.
- App Review notes: say that club admins subscribe in the app or on the
  website, that parents, coaches and players never pay, and give the review
  account a club on its trial so the plans show.
