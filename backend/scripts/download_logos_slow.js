const { Client } = require("pg");
const https = require("https");
const fs = require("fs");
const path = require("path");

const client = new Client({
  host: "swn-database.c0vossgkunoa.us-east-1.rds.amazonaws.com",
  port: 5432,
  database: "secondwatchnetwork",
  user: "swn_admin",
  password: "I6YvLh4FIUj2Wp40XeJ0mJVP",
  ssl: { rejectUnauthorized: false }
});

const FRONTEND_PUBLIC = "/home/estro/second-watch-network/frontend/public";

// Network logos - using commons.wikimedia.org direct file URLs
const networkLogos = {
  "ae": "https://upload.wikimedia.org/wikipedia/commons/5/54/A%26E_Network_logo.svg",
  "amc": "https://upload.wikimedia.org/wikipedia/commons/5/5c/AMC_logo_2016.svg",
  "bet": "https://upload.wikimedia.org/wikipedia/commons/d/d2/BET_Logo_2.svg",
  "bravo": "https://upload.wikimedia.org/wikipedia/commons/e/e3/Bravo_TV.svg",
  "cbs": "https://upload.wikimedia.org/wikipedia/commons/e/ee/CBS_logo_%282020%29.svg",
  "cnn": "https://upload.wikimedia.org/wikipedia/commons/b/b1/CNN.svg",
  "comedy-central": "https://upload.wikimedia.org/wikipedia/commons/b/b6/Comedy_Central_2018.svg",
  "discovery": "https://upload.wikimedia.org/wikipedia/commons/5/52/Discovery_Channel_-_Logo_2019.svg",
  "disney-channel": "https://upload.wikimedia.org/wikipedia/commons/4/4a/Disney_Channel_-_2019_logo.svg",
  "disney-plus": "https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg",
  "food-network": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Food_Network_New_Logo.svg",
  "fox": "https://upload.wikimedia.org/wikipedia/commons/c/c0/Fox_Broadcasting_Company_logo_%282019%29.svg",
  "freeform": "https://upload.wikimedia.org/wikipedia/commons/8/87/Freeform_logo.svg",
  "fx": "https://upload.wikimedia.org/wikipedia/commons/f/f0/FX_International_logo.svg",
  "hbo": "https://upload.wikimedia.org/wikipedia/commons/d/de/HBO_logo.svg",
  "hbo-max": "https://upload.wikimedia.org/wikipedia/commons/d/de/HBO_Max_Logo.svg",
  "hgtv": "https://upload.wikimedia.org/wikipedia/commons/c/c1/HGTV_US_Logo_2015.svg",
  "history": "https://upload.wikimedia.org/wikipedia/commons/f/f5/History_Logo.svg",
  "hulu": "https://upload.wikimedia.org/wikipedia/commons/e/e4/Hulu_Logo.svg",
  "lifetime": "https://upload.wikimedia.org/wikipedia/commons/a/aa/Lifetime_logo17.svg",
  "msnbc": "https://upload.wikimedia.org/wikipedia/commons/5/53/MSNBC_2015_logo.svg",
  "natgeo": "https://upload.wikimedia.org/wikipedia/commons/f/fc/Natgeo_logo.svg",
  "nickelodeon": "https://upload.wikimedia.org/wikipedia/commons/e/eb/Nickelodeon_logo_new.svg",
  "own": "https://upload.wikimedia.org/wikipedia/commons/a/a7/OWN_Logo.svg",
  "paramount-plus": "https://upload.wikimedia.org/wikipedia/commons/4/4e/Paramount%2B_logo.svg",
  "pbs": "https://upload.wikimedia.org/wikipedia/commons/d/d4/PBS_2019.svg",
  "peacock": "https://upload.wikimedia.org/wikipedia/commons/d/d3/NBCUniversal_Peacock_Logo.svg",
  "amazon-prime": "https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg",
  "apple-tv": "https://upload.wikimedia.org/wikipedia/commons/a/ad/Apple_TV_Plus_Logo.svg",
  "showtime": "https://upload.wikimedia.org/wikipedia/commons/c/ce/Showtime_2023.svg",
  "starz": "https://upload.wikimedia.org/wikipedia/commons/2/21/Starz_2022.svg",
  "syfy": "https://upload.wikimedia.org/wikipedia/commons/9/9f/Syfy_%282017%29.svg",
  "tbs": "https://upload.wikimedia.org/wikipedia/commons/e/ee/TBS_logo_2016.svg",
  "the-cw": "https://upload.wikimedia.org/wikipedia/commons/5/5e/The_CW_logo_2024.svg",
  "tlc": "https://upload.wikimedia.org/wikipedia/commons/6/67/TLC_Logo.svg",
  "travel": "https://upload.wikimedia.org/wikipedia/commons/9/9e/Travel_Channel_-_2018_Logo.svg",
  "usa": "https://upload.wikimedia.org/wikipedia/commons/a/ad/USA_Network_logo_%282016%29.svg",
  "vh1": "https://upload.wikimedia.org/wikipedia/commons/b/b0/VH1_logo_2017.svg"
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/svg+xml,image/png,image/*,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://en.wikipedia.org/'
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });

    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function run() {
  await client.connect();
  console.log("Connected to database");

  const networksDir = path.join(FRONTEND_PUBLIC, "images/networks");

  let successCount = 0;
  let failCount = 0;

  const entries = Object.entries(networkLogos);

  for (let i = 0; i < entries.length; i++) {
    const [slug, url] = entries[i];
    const filename = `${slug}.svg`;
    const filePath = path.join(networksDir, filename);
    const localUrl = `/images/networks/${filename}`;

    try {
      // Skip if exists and is valid size
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) {
        console.log(`Skipping ${slug} (exists)`);
        await client.query(
          "UPDATE tv_networks SET logo_url = $1 WHERE slug = $2",
          [localUrl, slug]
        );
        successCount++;
        continue;
      }

      console.log(`[${i + 1}/${entries.length}] Downloading ${slug}...`);
      await downloadFile(url, filePath);

      // Verify file size
      const stats = fs.statSync(filePath);
      if (stats.size < 100) {
        fs.unlinkSync(filePath);
        throw new Error('Downloaded file too small');
      }

      // Update database
      await client.query(
        "UPDATE tv_networks SET logo_url = $1 WHERE slug = $2",
        [localUrl, slug]
      );

      successCount++;
      console.log(`  ✓ Success (${stats.size} bytes)`);

      // Wait between downloads to avoid rate limiting
      if (i < entries.length - 1) {
        await sleep(2000);
      }
    } catch (err) {
      console.log(`  ✗ Failed: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\nDone! Success: ${successCount}, Failed: ${failCount}`);
  await client.end();
}

run().catch(console.error);
