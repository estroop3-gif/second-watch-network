const { Client } = require("pg");

const client = new Client({
  host: "swn-database.c0vossgkunoa.us-east-1.rds.amazonaws.com",
  port: 5432,
  database: "secondwatchnetwork",
  user: "swn_admin",
  password: "I6YvLh4FIUj2Wp40XeJ0mJVP",
  ssl: { rejectUnauthorized: false }
});

const networks = [
  { name: "MyNetworkTV", slug: "mynetworktv", category: "broadcast", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/MyNetworkTV_logo.svg/200px-MyNetworkTV_logo.svg.png" },
  { name: "Ion Television", slug: "ion", category: "broadcast", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/ION_Television_logo.svg/200px-ION_Television_logo.svg.png" },
  { name: "Telemundo", slug: "telemundo", category: "broadcast", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Telemundo_Logo_2018.svg/200px-Telemundo_Logo_2018.svg.png" },
  { name: "Univision", slug: "univision", category: "broadcast", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Logo_Univision_2019.svg/200px-Logo_Univision_2019.svg.png" },
  { name: "A&E", slug: "ae", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/A%26E_Network_logo.svg/200px-A%26E_Network_logo.svg.png" },
  { name: "AMC", slug: "amc", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/AMC_logo_2016.svg/200px-AMC_logo_2016.svg.png" },
  { name: "Animal Planet", slug: "animal-planet", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Animal_Planet_logo_2018.svg/200px-Animal_Planet_logo_2018.svg.png" },
  { name: "BET", slug: "bet", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/BET_Logo_2.svg/200px-BET_Logo_2.svg.png" },
  { name: "Bravo", slug: "bravo", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Bravo_TV.svg/200px-Bravo_TV.svg.png" },
  { name: "Cartoon Network", slug: "cartoon-network", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cartoon_Network_2010_logo.svg/200px-Cartoon_Network_2010_logo.svg.png" },
  { name: "CMT", slug: "cmt", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/CMT_%28ViacomCBS%29.svg/200px-CMT_%28ViacomCBS%29.svg.png" },
  { name: "Comedy Central", slug: "comedy-central", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Comedy_Central_2018.svg/200px-Comedy_Central_2018.svg.png" },
  { name: "Discovery Channel", slug: "discovery", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Discovery_Channel_-_Logo_2019.svg/200px-Discovery_Channel_-_Logo_2019.svg.png" },
  { name: "Disney Channel", slug: "disney-channel", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Disney_Channel_-_2019_logo.svg/200px-Disney_Channel_-_2019_logo.svg.png" },
  { name: "Disney XD", slug: "disney-xd", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Disney_XD_2015.svg/200px-Disney_XD_2015.svg.png" },
  { name: "E!", slug: "e", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/E%21_logo.svg/200px-E%21_logo.svg.png" },
  { name: "Food Network", slug: "food-network", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Food_Network_New_Logo.svg/200px-Food_Network_New_Logo.svg.png" },
  { name: "Freeform", slug: "freeform", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Freeform_logo.svg/200px-Freeform_logo.svg.png" },
  { name: "FX", slug: "fx", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/FX_International_logo.svg/200px-FX_International_logo.svg.png" },
  { name: "FXX", slug: "fxx", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/FXX_logo.svg/200px-FXX_logo.svg.png" },
  { name: "Hallmark Channel", slug: "hallmark", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Hallmark_Channel_logo.svg/200px-Hallmark_Channel_logo.svg.png" },
  { name: "HGTV", slug: "hgtv", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/HGTV_US_Logo_2015.svg/200px-HGTV_US_Logo_2015.svg.png" },
  { name: "History", slug: "history", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/History_Logo.svg/200px-History_Logo.svg.png" },
  { name: "IFC", slug: "ifc", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/IFC_logo.svg/200px-IFC_logo.svg.png" },
  { name: "Lifetime", slug: "lifetime", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Lifetime_logo17.svg/200px-Lifetime_logo17.svg.png" },
  { name: "MTV", slug: "mtv", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/MTV_2021_%28brand_version%29.svg/200px-MTV_2021_%28brand_version%29.svg.png" },
  { name: "National Geographic", slug: "natgeo", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Natgeo_logo.svg/200px-Natgeo_logo.svg.png" },
  { name: "Nickelodeon", slug: "nickelodeon", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Nickelodeon_logo_new.svg/200px-Nickelodeon_logo_new.svg.png" },
  { name: "OWN", slug: "own", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/OWN_Logo.svg/200px-OWN_Logo.svg.png" },
  { name: "Paramount Network", slug: "paramount-network", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Paramount_Network_2022.svg/200px-Paramount_Network_2022.svg.png" },
  { name: "Science Channel", slug: "science", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Science_Channel_2011.svg/200px-Science_Channel_2011.svg.png" },
  { name: "Smithsonian Channel", slug: "smithsonian", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Smithsonian_Channel.svg/200px-Smithsonian_Channel.svg.png" },
  { name: "Sundance TV", slug: "sundance", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/SundanceTV_Logo.svg/200px-SundanceTV_Logo.svg.png" },
  { name: "Syfy", slug: "syfy", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Syfy_%282017%29.svg/200px-Syfy_%282017%29.svg.png" },
  { name: "TBS", slug: "tbs", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/TBS_logo_2016.svg/200px-TBS_logo_2016.svg.png" },
  { name: "TCM", slug: "tcm", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Turner_Classic_Movies_logo.svg/200px-Turner_Classic_Movies_logo.svg.png" },
  { name: "TLC", slug: "tlc", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/TLC_Logo.svg/200px-TLC_Logo.svg.png" },
  { name: "TNT", slug: "tnt", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/TNT_Logo_2016.svg/200px-TNT_Logo_2016.svg.png" },
  { name: "Travel Channel", slug: "travel", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Travel_Channel_-_2018_Logo.svg/200px-Travel_Channel_-_2018_Logo.svg.png" },
  { name: "TruTV", slug: "trutv", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/TruTV_2017_logo.svg/200px-TruTV_2017_logo.svg.png" },
  { name: "TV Land", slug: "tv-land", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/TV_Land_2015_logo.svg/200px-TV_Land_2015_logo.svg.png" },
  { name: "USA Network", slug: "usa", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/USA_Network_logo_%282016%29.svg/200px-USA_Network_logo_%282016%29.svg.png" },
  { name: "VH1", slug: "vh1", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/VH1_logo_2017.svg/200px-VH1_logo_2017.svg.png" },
  { name: "WE tv", slug: "we-tv", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/WE_tv_logo.svg/200px-WE_tv_logo.svg.png" },
  { name: "Cinemax", slug: "cinemax", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Cinemax_2021.svg/200px-Cinemax_2021.svg.png" },
  { name: "Starz", slug: "starz", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Starz_2022.svg/200px-Starz_2022.svg.png" },
  { name: "Showtime", slug: "showtime", category: "cable", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Showtime_2023.svg/200px-Showtime_2023.svg.png" },
  { name: "Crunchyroll", slug: "crunchyroll", category: "streaming", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Crunchyroll_Logo.svg/200px-Crunchyroll_Logo.svg.png" },
  { name: "Pluto TV", slug: "pluto-tv", category: "streaming", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Pluto_TV_logo.svg/200px-Pluto_TV_logo.svg.png" },
  { name: "Tubi", slug: "tubi", category: "streaming", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Tubi_logo.svg/200px-Tubi_logo.svg.png" },
  { name: "Discovery+", slug: "discovery-plus", category: "streaming", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Discovery%2B_logo.svg/200px-Discovery%2B_logo.svg.png" },
  { name: "Shudder", slug: "shudder", category: "streaming", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Shudder_logo.svg/200px-Shudder_logo.svg.png" },
  { name: "Paramount+", slug: "paramount-plus", category: "streaming", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Paramount%2B_logo.svg/200px-Paramount%2B_logo.svg.png" },
  { name: "BBC America", slug: "bbc-america", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/BBC_America_logo.svg/200px-BBC_America_logo.svg.png" },
  { name: "Bloomberg TV", slug: "bloomberg", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Bloomberg_Television_2022.svg/200px-Bloomberg_Television_2022.svg.png" },
  { name: "C-SPAN", slug: "cspan", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/C-SPAN_Logo.svg/200px-C-SPAN_Logo.svg.png" },
  { name: "NewsNation", slug: "newsnation", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/NewsNation_logo.svg/200px-NewsNation_logo.svg.png" },
  { name: "Newsmax", slug: "newsmax", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Newsmax_2021.svg/200px-Newsmax_2021.svg.png" },
  { name: "ACC Network", slug: "acc-network", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/ACC_Network_logo.svg/200px-ACC_Network_logo.svg.png" },
  { name: "Big Ten Network", slug: "btn", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Big_Ten_Network_logo.svg/200px-Big_Ten_Network_logo.svg.png" },
  { name: "CBS Sports Network", slug: "cbs-sports", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/CBS_Sports_Network.svg/200px-CBS_Sports_Network.svg.png" },
  { name: "FS1", slug: "fs1", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Fox_Sports_1_logo.svg/200px-Fox_Sports_1_logo.svg.png" },
  { name: "FS2", slug: "fs2", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Fox_Sports_2_logo.svg/200px-Fox_Sports_2_logo.svg.png" },
  { name: "Golf Channel", slug: "golf", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Golf_Channel_2018_logo.svg/200px-Golf_Channel_2018_logo.svg.png" },
  { name: "MLB Network", slug: "mlb-network", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/MLB_Network_Logo.svg/200px-MLB_Network_Logo.svg.png" },
  { name: "NBA TV", slug: "nba-tv", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/NBA_TV_logo.svg/200px-NBA_TV_logo.svg.png" },
  { name: "NFL Network", slug: "nfl-network", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/NFL_Network_logo.svg/200px-NFL_Network_logo.svg.png" },
  { name: "NHL Network", slug: "nhl-network", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/NHL_Network_2012.svg/200px-NHL_Network_2012.svg.png" },
  { name: "SEC Network", slug: "sec-network", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/SEC_Network_logo.svg/200px-SEC_Network_logo.svg.png" },
  { name: "Tennis Channel", slug: "tennis", category: "news", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Tennis_Channel_Logo.svg/200px-Tennis_Channel_Logo.svg.png" },
  { name: "BBC One", slug: "bbc-one", category: "specialty", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/BBC_One_logo.svg/200px-BBC_One_logo.svg.png" },
  { name: "BBC Two", slug: "bbc-two", category: "specialty", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/BBC_Two_logo.svg/200px-BBC_Two_logo.svg.png" },
  { name: "Channel 4", slug: "channel-4", category: "specialty", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Channel_4_logo_2015.svg/200px-Channel_4_logo_2015.svg.png" },
  { name: "ITV", slug: "itv", category: "specialty", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/ITV_logo_2019.svg/200px-ITV_logo_2019.svg.png" },
  { name: "Sky", slug: "sky", category: "specialty", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Sky_UK_2020.svg/200px-Sky_UK_2020.svg.png" },
  { name: "CBC", slug: "cbc", category: "specialty", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/CBC_Television_2009.svg/200px-CBC_Television_2009.svg.png" },
  { name: "CTV", slug: "ctv", category: "specialty", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/CTV_Logo.svg/200px-CTV_Logo.svg.png" },
  { name: "Global TV", slug: "global-tv", category: "specialty", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Global_TV_logo.svg/200px-Global_TV_logo.svg.png" },
  { name: "NHK", slug: "nhk", category: "specialty", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/NHK_logo.svg/200px-NHK_logo.svg.png" },
  { name: "TV Azteca", slug: "tv-azteca", category: "specialty", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/TV_Azteca_Logo.svg/200px-TV_Azteca_Logo.svg.png" },
  { name: "Televisa", slug: "televisa", category: "specialty", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Televisa_2022.svg/200px-Televisa_2022.svg.png" }
];

async function run() {
  await client.connect();

  const existing = await client.query("SELECT slug FROM tv_networks");
  const existingSlugs = new Set(existing.rows.map(r => r.slug));
  console.log("Existing networks:", existing.rows.length);

  const newNetworks = networks.filter(n => !existingSlugs.has(n.slug));
  console.log("New networks to add:", newNetworks.length);

  if (newNetworks.length === 0) {
    console.log("All networks already exist");
    await client.end();
    return;
  }

  const maxOrders = await client.query("SELECT category, MAX(sort_order) as max_order FROM tv_networks GROUP BY category");
  const orderMap = {};
  maxOrders.rows.forEach(r => orderMap[r.category] = (r.max_order || 0) + 1);

  let added = 0;
  for (const network of newNetworks) {
    try {
      const order = orderMap[network.category] || 1;
      orderMap[network.category] = order + 1;

      await client.query(
        "INSERT INTO tv_networks (name, slug, logo_url, category, is_active, sort_order) VALUES ($1, $2, $3, $4, true, $5)",
        [network.name, network.slug, network.logo_url, network.category, order]
      );
      added++;
    } catch (e) {
      console.log("Failed to add " + network.name + ": " + e.message);
    }
  }

  console.log("Successfully added", added, "networks");

  const total = await client.query("SELECT COUNT(*) FROM tv_networks");
  console.log("Total networks now:", total.rows[0].count);

  await client.end();
}

run().catch(console.error);
