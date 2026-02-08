const axios = require('axios');
const cheerio = require('cheerio');

const fetchMetadata = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Try to get title from various meta tags
    let title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text() ||
                $('h1').first().text();

    // Clean up title
    if (title) {
      title = title.trim().replace(/\s+/g, ' ');
    }

    return title || null;
  } catch (error) {
    console.error('Error fetching metadata:', error.message);
    return null;
  }
};

module.exports = fetchMetadata;

