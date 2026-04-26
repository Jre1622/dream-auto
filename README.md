# Dream Auto

Dream Auto is the website and inventory manager for Dream Auto in Elk River, MN.

- Live site: https://dreamautomn.com
- Address: 580 Dodge Ave NW, Elk River, MN 55330
- Email: DreamAutosMN@gmail.com

## What It Does

- Public dealership website
- Vehicle inventory listing and vehicle detail pages
- Admin dashboard for adding/editing/deleting vehicles
- Multiple vehicle image uploads to Cloudflare R2
- Featured/sold vehicle flags
- Minnesota tax/title/license calculator
- Contract form with downloadable PDF generation

## Stack

- Node.js
- Express
- EJS templates
- SQLite database
- Tailwind CSS
- Cloudflare R2 for vehicle images
- PM2 for keeping the Node app running
- Caddy for HTTPS and reverse proxy
- DigitalOcean Ubuntu VPS
- NameCheap DNS

## Live Server Setup

The live app runs on a DigitalOcean VPS.

```txt
dreamautomn.com
  -> 162.243.217.235 DigitalOcean VPS
  -> Caddy on ports 80/443
  -> Node/Express app on port 3000
  -> SQLite database at /home/dream-auto/db/database.db
  -> Cloudflare R2 for uploaded vehicle images
```

VPS details:

- Hostname: `ubuntu-s-1vcpu-512mb-10gb-nyc2-01`
- App path: `/home/dream-auto`
- Node process: `node /home/dream-auto/server.js`
- PM2 manages the app
- Caddy handles HTTPS automatically
- nginx was removed

Current Caddy config should be roughly:

```caddyfile
dreamautomn.com {
    reverse_proxy localhost:3000
}
```

`www.dreamautomn.com` is not currently configured in DNS. If needed later, add DNS for `www` and use:

```caddyfile
www.dreamautomn.com {
    redir https://dreamautomn.com{uri} permanent
}

dreamautomn.com {
    reverse_proxy localhost:3000
}
```

## Local Development

Install dependencies:

```bash
npm install
```

Build CSS:

```bash
npm run build:css
```

Run app:

```bash
npm start
```

The app runs on `PORT` from `.env`, or `3000` by default.

## Environment Variables

Create `.env` locally or on the VPS:

```bash
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password

R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name

DEALERSHIP_PHONE="+1-555-123-4567"
PORT=3000
```

## Deploying Updates

SSH into the VPS, then:

```bash
cd /home/dream-auto
git pull
npm install
npm run build:css
pm2 restart all
```

Check that it is running:

```bash
pm2 list
curl -I https://dreamautomn.com
```

Expected response header includes:

```txt
via: 1.1 Caddy
x-powered-by: Express
```

## Useful VPS Commands

App status/logs:

```bash
pm2 list
pm2 logs
pm2 describe all
```

Caddy status:

```bash
sudo systemctl status caddy --no-pager
sudo caddy validate --config /etc/caddy/Caddyfile
sudo cat /etc/caddy/Caddyfile
```

Ports:

```bash
sudo ss -tulpn | grep -E ':80|:443|:3000'
```

Expected ports:

```txt
:80   -> caddy
:443  -> caddy
:3000 -> node
```

Restart services:

```bash
pm2 restart all
sudo systemctl restart caddy
```

## Project Structure

```txt
config/r2.js              Cloudflare R2 client config
db/database.js            SQLite connection and schema
db/database.db            Live/local SQLite data file, ignored by git
public/                   Static CSS, JS, images
routes/admin.js           Admin inventory routes
routes/inventory.js       Public inventory routes
utils/imageUpload.js      R2 image upload/delete helpers
views/                    EJS templates
server.js                 Express app entry point
```

## Main Routes

Public:

- `/` homepage
- `/inventory` inventory listing/filtering
- `/inventory/:id` vehicle detail page
- `/calculator` Minnesota tax/title/license calculator
- `/contract` contract form
- `/generate-contract` PDF download route

Admin:

- `/admin` dashboard
- `/admin/add-car`
- `/admin/edit-car/:id`

Admin uses HTTP Basic Auth from `.env`.

## Data Notes

- Vehicle data is stored in SQLite.
- Vehicle images are stored in Cloudflare R2.
- Image URLs and display order are stored in SQLite.
- The live database file is on the VPS and is not committed to git.

## Future Ideas

- Add `www.dreamautomn.com` DNS and redirect to non-www
- Add `sitemap.xml`
- Add `robots.txt`
- Add local business JSON schema
- Add Google Search Console / Bing Search Console
- Add analytics
- Add VIN copy button
- Add open/closed banner based on business hours
