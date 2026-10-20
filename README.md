# Medha Consulting – Employee Check-In/Out (test version)

A simple web page employees open on their phone to **Check In** or **Check Out**.
It only accepts a check-in if the phone is within **500 metres** of the test location set in `app.js`.

- Employee page: https://medhaconsulting.github.io/medha-checkin/
- Admin page: https://medhaconsulting.github.io/medha-checkin/admin.html

## How it works (employees)
1. Type your name (and employee ID if you have one). The phone remembers it.
2. Tap **Check In** or **Check Out**, and tap **Allow** when asked for location.
3. The page measures how far you are from the office.
   - Within 500 m → the record is sent to the company log (a Supabase database) **and** a backup copy is kept on the phone.
   - Too far → nothing is saved, and it tells you how far away you are.
   - If the internet fails, you see a warning and the record is marked "⚠️ not sent" in the phone's history.
4. Employees can only **add** records. They cannot see, change or delete anyone's records.

## How it works (admin)
1. Open the admin page (small "Admin" link at the bottom of the main page).
2. Enter your email and tap **Send me a sign-in link**, then open the link in the email.
3. You see all check-ins, newest first, in Phnom Penh time. Pick a date or tap **Show all**.
4. **Download CSV** saves what's on screen as a spreadsheet. **Sign out** when done.

Only `ot.chandy@gmail.com` can see records. Anyone else who signs in sees an empty list (the database blocks them).

## Files
- `index.html`, `app.js` – the employee page and its logic (settings in the `CONFIG` block at the top of `app.js`)
- `admin.html`, `admin.js` – the admin page
- `config.js` – Supabase address and **public** key (safe to be public; never put the secret "service_role" key here)
- `db.js` – sends check-ins to Supabase
- `style.css` – the look
- `supabase/checkins.sql` – the database table and security rules (already applied)
- `test.js` – a small check of the distance maths (`node test.js`)

## Hosting
The site is published by GitHub Pages from the `main` branch. Pushing changes to `main` updates the site in about a minute.
