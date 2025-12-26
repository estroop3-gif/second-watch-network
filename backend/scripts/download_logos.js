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

// Network logos with Wikipedia URLs
const networkLogos = {
  "mynetworktv": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/MyNetworkTV_logo.svg/200px-MyNetworkTV_logo.svg.png",
  "ion": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/ION_Television_logo.svg/200px-ION_Television_logo.svg.png",
  "telemundo": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Telemundo_Logo_2018.svg/200px-Telemundo_Logo_2018.svg.png",
  "univision": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Logo_Univision_2019.svg/200px-Logo_Univision_2019.svg.png",
  "ae": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/A%26E_Network_logo.svg/200px-A%26E_Network_logo.svg.png",
  "amc": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/AMC_logo_2016.svg/200px-AMC_logo_2016.svg.png",
  "animal-planet": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Animal_Planet_logo_2018.svg/200px-Animal_Planet_logo_2018.svg.png",
  "bet": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/BET_Logo_2.svg/200px-BET_Logo_2.svg.png",
  "bravo": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Bravo_TV.svg/200px-Bravo_TV.svg.png",
  "cartoon-network": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cartoon_Network_2010_logo.svg/200px-Cartoon_Network_2010_logo.svg.png",
  "cmt": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/CMT_%28ViacomCBS%29.svg/200px-CMT_%28ViacomCBS%29.svg.png",
  "comedy-central": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Comedy_Central_2018.svg/200px-Comedy_Central_2018.svg.png",
  "discovery": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Discovery_Channel_-_Logo_2019.svg/200px-Discovery_Channel_-_Logo_2019.svg.png",
  "disney-channel": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Disney_Channel_-_2019_logo.svg/200px-Disney_Channel_-_2019_logo.svg.png",
  "disney-xd": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Disney_XD_2015.svg/200px-Disney_XD_2015.svg.png",
  "e": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/E%21_logo.svg/200px-E%21_logo.svg.png",
  "food-network": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Food_Network_New_Logo.svg/200px-Food_Network_New_Logo.svg.png",
  "freeform": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Freeform_logo.svg/200px-Freeform_logo.svg.png",
  "fx": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/FX_International_logo.svg/200px-FX_International_logo.svg.png",
  "fxx": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/FXX_logo.svg/200px-FXX_logo.svg.png",
  "hallmark": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Hallmark_Channel_logo.svg/200px-Hallmark_Channel_logo.svg.png",
  "hgtv": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/HGTV_US_Logo_2015.svg/200px-HGTV_US_Logo_2015.svg.png",
  "history": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/History_Logo.svg/200px-History_Logo.svg.png",
  "ifc": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/IFC_logo.svg/200px-IFC_logo.svg.png",
  "lifetime": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Lifetime_logo17.svg/200px-Lifetime_logo17.svg.png",
  "mtv": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/MTV_2021_%28brand_version%29.svg/200px-MTV_2021_%28brand_version%29.svg.png",
  "natgeo": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Natgeo_logo.svg/200px-Natgeo_logo.svg.png",
  "nickelodeon": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Nickelodeon_logo_new.svg/200px-Nickelodeon_logo_new.svg.png",
  "own": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/OWN_Logo.svg/200px-OWN_Logo.svg.png",
  "paramount-network": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Paramount_Network_2022.svg/200px-Paramount_Network_2022.svg.png",
  "science": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Science_Channel_2011.svg/200px-Science_Channel_2011.svg.png",
  "smithsonian": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Smithsonian_Channel.svg/200px-Smithsonian_Channel.svg.png",
  "sundance": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/SundanceTV_Logo.svg/200px-SundanceTV_Logo.svg.png",
  "syfy": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Syfy_%282017%29.svg/200px-Syfy_%282017%29.svg.png",
  "tbs": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/TBS_logo_2016.svg/200px-TBS_logo_2016.svg.png",
  "tcm": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Turner_Classic_Movies_logo.svg/200px-Turner_Classic_Movies_logo.svg.png",
  "tlc": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/TLC_Logo.svg/200px-TLC_Logo.svg.png",
  "tnt": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/TNT_Logo_2016.svg/200px-TNT_Logo_2016.svg.png",
  "travel": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Travel_Channel_-_2018_Logo.svg/200px-Travel_Channel_-_2018_Logo.svg.png",
  "trutv": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/TruTV_2017_logo.svg/200px-TruTV_2017_logo.svg.png",
  "tv-land": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/TV_Land_2015_logo.svg/200px-TV_Land_2015_logo.svg.png",
  "usa": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/USA_Network_logo_%282016%29.svg/200px-USA_Network_logo_%282016%29.svg.png",
  "vh1": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/VH1_logo_2017.svg/200px-VH1_logo_2017.svg.png",
  "we-tv": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/WE_tv_logo.svg/200px-WE_tv_logo.svg.png",
  "cinemax": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Cinemax_2021.svg/200px-Cinemax_2021.svg.png",
  "starz": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Starz_2022.svg/200px-Starz_2022.svg.png",
  "showtime": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Showtime_2023.svg/200px-Showtime_2023.svg.png",
  "crunchyroll": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Crunchyroll_Logo.svg/200px-Crunchyroll_Logo.svg.png",
  "pluto-tv": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Pluto_TV_logo.svg/200px-Pluto_TV_logo.svg.png",
  "tubi": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Tubi_logo.svg/200px-Tubi_logo.svg.png",
  "discovery-plus": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Discovery%2B_logo.svg/200px-Discovery%2B_logo.svg.png",
  "shudder": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Shudder_logo.svg/200px-Shudder_logo.svg.png",
  "paramount-plus": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Paramount%2B_logo.svg/200px-Paramount%2B_logo.svg.png",
  "bbc-america": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/BBC_America_logo.svg/200px-BBC_America_logo.svg.png",
  "bloomberg": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Bloomberg_Television_2022.svg/200px-Bloomberg_Television_2022.svg.png",
  "cspan": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/C-SPAN_Logo.svg/200px-C-SPAN_Logo.svg.png",
  "newsnation": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/NewsNation_logo.svg/200px-NewsNation_logo.svg.png",
  "newsmax": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Newsmax_2021.svg/200px-Newsmax_2021.svg.png",
  "acc-network": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/ACC_Network_logo.svg/200px-ACC_Network_logo.svg.png",
  "btn": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Big_Ten_Network_logo.svg/200px-Big_Ten_Network_logo.svg.png",
  "cbs-sports": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/CBS_Sports_Network.svg/200px-CBS_Sports_Network.svg.png",
  "fs1": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Fox_Sports_1_logo.svg/200px-Fox_Sports_1_logo.svg.png",
  "fs2": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Fox_Sports_2_logo.svg/200px-Fox_Sports_2_logo.svg.png",
  "golf": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Golf_Channel_2018_logo.svg/200px-Golf_Channel_2018_logo.svg.png",
  "mlb-network": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/MLB_Network_Logo.svg/200px-MLB_Network_Logo.svg.png",
  "nba-tv": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/NBA_TV_logo.svg/200px-NBA_TV_logo.svg.png",
  "nfl-network": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/NFL_Network_logo.svg/200px-NFL_Network_logo.svg.png",
  "nhl-network": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/NHL_Network_2012.svg/200px-NHL_Network_2012.svg.png",
  "sec-network": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/SEC_Network_logo.svg/200px-SEC_Network_logo.svg.png",
  "tennis": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Tennis_Channel_Logo.svg/200px-Tennis_Channel_Logo.svg.png",
  "bbc-one": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/BBC_One_logo.svg/200px-BBC_One_logo.svg.png",
  "bbc-two": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/BBC_Two_logo.svg/200px-BBC_Two_logo.svg.png",
  "channel-4": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Channel_4_logo_2015.svg/200px-Channel_4_logo_2015.svg.png",
  "itv": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/ITV_logo_2019.svg/200px-ITV_logo_2019.svg.png",
  "sky": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Sky_UK_2020.svg/200px-Sky_UK_2020.svg.png",
  "cbc": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/CBC_Television_2009.svg/200px-CBC_Television_2009.svg.png",
  "ctv": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/CTV_Logo.svg/200px-CTV_Logo.svg.png",
  "global-tv": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Global_TV_logo.svg/200px-Global_TV_logo.svg.png",
  "nhk": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/NHK_logo.svg/200px-NHK_logo.svg.png",
  "tv-azteca": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/TV_Azteca_Logo.svg/200px-TV_Azteca_Logo.svg.png",
  "televisa": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Televisa_2022.svg/200px-Televisa_2022.svg.png",
  // Major broadcast networks
  "abc": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ABC-2021-LOGO.svg/200px-ABC-2021-LOGO.svg.png",
  "cbs": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/CBS_logo_%282020%29.svg/200px-CBS_logo_%282020%29.svg.png",
  "nbc": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/NBC_logo.svg/200px-NBC_logo.svg.png",
  "fox": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Fox_Broadcasting_Company_logo_%282019%29.svg/200px-Fox_Broadcasting_Company_logo_%282019%29.svg.png",
  "the-cw": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/The_CW_logo_2024.svg/200px-The_CW_logo_2024.svg.png",
  "pbs": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/PBS_2019.svg/200px-PBS_2019.svg.png",
  // Streaming
  "netflix": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/200px-Netflix_2015_logo.svg.png",
  "amazon-prime": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/200px-Amazon_Prime_Video_logo.svg.png",
  "disney-plus": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/200px-Disney%2B_logo.svg.png",
  "hbo-max": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/HBO_Max_Logo.svg/200px-HBO_Max_Logo.svg.png",
  "hulu": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Hulu_Logo.svg/200px-Hulu_Logo.svg.png",
  "apple-tv": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Apple_TV_Plus_Logo.svg/200px-Apple_TV_Plus_Logo.svg.png",
  "peacock": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/NBCUniversal_Peacock_Logo.svg/200px-NBCUniversal_Peacock_Logo.svg.png",
  // News
  "cnn": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/CNN.svg/200px-CNN.svg.png",
  "fox-news": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Fox_News_Channel_logo.svg/200px-Fox_News_Channel_logo.svg.png",
  "msnbc": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/MSNBC_2015_logo.svg/200px-MSNBC_2015_logo.svg.png",
  "espn": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/200px-ESPN_wordmark.svg.png",
  "hbo": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/HBO_logo.svg/200px-HBO_logo.svg.png"
};

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
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
      fs.unlink(destPath, () => {});
      reject(err);
    });

    request.setTimeout(10000, () => {
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

  for (const [slug, url] of Object.entries(networkLogos)) {
    const filename = `${slug}.png`;
    const filePath = path.join(networksDir, filename);
    const localUrl = `/images/networks/${filename}`;

    try {
      // Download if not exists
      if (!fs.existsSync(filePath)) {
        console.log(`Downloading ${slug}...`);
        await downloadFile(url, filePath);
      }

      // Update database
      await client.query(
        "UPDATE tv_networks SET logo_url = $1 WHERE slug = $2",
        [localUrl, slug]
      );

      successCount++;
    } catch (err) {
      console.error(`Failed ${slug}: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\nDone! Success: ${successCount}, Failed: ${failCount}`);
  await client.end();
}

run().catch(console.error);
