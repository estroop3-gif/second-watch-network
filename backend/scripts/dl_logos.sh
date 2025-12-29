#!/bin/bash
cd /home/estro/second-watch-network/frontend/public/images/networks

download_logo() {
  local slug=$1
  local url=$2
  if [ ! -f "${slug}.png" ] || [ $(stat -c%s "${slug}.png" 2>/dev/null || echo 0) -lt 500 ]; then
    echo "Downloading $slug..."
    curl -s -L -o "${slug}.png" -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "$url"
    local size=$(stat -c%s "${slug}.png" 2>/dev/null || echo 0)
    if [ $size -gt 500 ]; then
      echo "  ✓ Success ($size bytes)"
    else
      rm -f "${slug}.png"
      echo "  ✗ Failed"
    fi
    sleep 2
  else
    echo "Skipping $slug (exists)"
  fi
}

# Major networks
download_logo "cbs" "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/CBS_logo_%282020%29.svg/200px-CBS_logo_%282020%29.svg.png"
download_logo "hbo" "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/HBO_logo.svg/200px-HBO_logo.svg.png"
download_logo "disney-plus" "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/200px-Disney%2B_logo.svg.png"
download_logo "hulu" "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Hulu_Logo.svg/200px-Hulu_Logo.svg.png"
download_logo "amazon-prime" "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/200px-Amazon_Prime_Video_logo.svg.png"
download_logo "fox" "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Fox_Broadcasting_Company_logo_%282019%29.svg/200px-Fox_Broadcasting_Company_logo_%282019%29.svg.png"
download_logo "cnn" "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/CNN.svg/200px-CNN.svg.png"
download_logo "msnbc" "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/MSNBC_2015_logo.svg/200px-MSNBC_2015_logo.svg.png"
download_logo "discovery" "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Discovery_Channel_-_Logo_2019.svg/200px-Discovery_Channel_-_Logo_2019.svg.png"
download_logo "history" "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/History_Logo.svg/200px-History_Logo.svg.png"
download_logo "amc" "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/AMC_logo_2016.svg/200px-AMC_logo_2016.svg.png"
download_logo "fx" "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/FX_International_logo.svg/200px-FX_International_logo.svg.png"
download_logo "usa" "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/USA_Network_logo_%282016%29.svg/200px-USA_Network_logo_%282016%29.svg.png"
download_logo "syfy" "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Syfy_%282017%29.svg/200px-Syfy_%282017%29.svg.png"
download_logo "tbs" "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/TBS_logo_2016.svg/200px-TBS_logo_2016.svg.png"
download_logo "bravo" "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Bravo_TV.svg/200px-Bravo_TV.svg.png"
download_logo "bet" "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/BET_Logo_2.svg/200px-BET_Logo_2.svg.png"
download_logo "nickelodeon" "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Nickelodeon_logo_new.svg/200px-Nickelodeon_logo_new.svg.png"
download_logo "disney-channel" "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Disney_Channel_-_2019_logo.svg/200px-Disney_Channel_-_2019_logo.svg.png"
download_logo "comedy-central" "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Comedy_Central_2018.svg/200px-Comedy_Central_2018.svg.png"
download_logo "hgtv" "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/HGTV_US_Logo_2015.svg/200px-HGTV_US_Logo_2015.svg.png"
download_logo "food-network" "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Food_Network_New_Logo.svg/200px-Food_Network_New_Logo.svg.png"
download_logo "tlc" "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/TLC_Logo.svg/200px-TLC_Logo.svg.png"
download_logo "natgeo" "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Natgeo_logo.svg/200px-Natgeo_logo.svg.png"
download_logo "ae" "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/A%26E_Network_logo.svg/200px-A%26E_Network_logo.svg.png"
download_logo "lifetime" "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Lifetime_logo17.svg/200px-Lifetime_logo17.svg.png"
download_logo "vh1" "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/VH1_logo_2017.svg/200px-VH1_logo_2017.svg.png"
download_logo "paramount-plus" "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Paramount%2B_logo.svg/200px-Paramount%2B_logo.svg.png"
download_logo "peacock" "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/NBCUniversal_Peacock_Logo.svg/200px-NBCUniversal_Peacock_Logo.svg.png"
download_logo "apple-tv" "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Apple_TV_Plus_Logo.svg/200px-Apple_TV_Plus_Logo.svg.png"
download_logo "showtime" "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Showtime_2023.svg/200px-Showtime_2023.svg.png"
download_logo "starz" "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Starz_2022.svg/200px-Starz_2022.svg.png"
download_logo "pbs" "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/PBS_2019.svg/200px-PBS_2019.svg.png"
download_logo "the-cw" "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/The_CW_logo_2024.svg/200px-The_CW_logo_2024.svg.png"
download_logo "hbo-max" "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/HBO_Max_Logo.svg/200px-HBO_Max_Logo.svg.png"

echo ""
echo "Done! Counting valid files:"
find . -name "*.png" -size +500c | wc -l
