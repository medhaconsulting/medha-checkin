# Medha Consulting – Employee Check-In/Out (test version)

A simple web page employees open on their phone to **Check In** or **Check Out**.
It only records the check-in if the phone is within **500 metres** of the test location set in `app.js`
(No. 162 Preah Norodom Blvd, Phnom Penh).

## How it works
1. Type your name (and employee ID if you have one). The phone remembers it.
2. Tap **Check In** or **Check Out**. The phone asks permission to use your location — tap Allow.
3. The page measures how far you are from the office.
   - Within 500 m → the record is saved (name, IN/OUT, Phnom Penh time, GPS position, distance).
   - Too far → nothing is saved, and it tells you how far away you are.
4. Today's records show at the bottom. **Download CSV** saves all records as a spreadsheet file.

**Important:** in this test version, records are saved **only on that phone's browser**.
A manager cannot see everyone's records in one place yet (that comes later with a database such as Supabase).

## Files
- `index.html` – the page
- `style.css` – the look
- `app.js` – the logic. The settings (company, office coordinates, radius) are in the `CONFIG` block at the top.
- `test.js` – a small check of the distance maths (`node test.js`)

## Put it online with GitHub Pages
1. Create a new repository on GitHub and upload these files.
2. In the repository, go to **Settings → Pages**.
3. Under "Source", choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
4. After a minute, your link appears, like `https://<your-username>.github.io/<repo-name>/`.
5. Open the link on a phone. (Location only works over `https://`, which GitHub Pages provides.)
