import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.SERP_API_KEY;

async function fetchCompanyReview(companyName) {
  try {
    const response = await axios.get("https://serpapi.com/search.json", {
      params: {
        engine: "google",
        q: `${companyName} company reviews site:glassdoor.com`,
        api_key: apiKey,
      },
    });

    const result = response.data.organic_results?.[0];
    const reviews = result?.snippet?.split(".").slice(0, 2).map((r) => r.trim()) || ["No reviews found"];
    const ratingMatch = result?.snippet?.match(/([0-5]\.?[0-9]?)\s*stars?/i);
    const rating = ratingMatch ? ratingMatch[1] : "N/A";

    return { name: companyName, rating, reviews };
  } catch (err) {
    return { name: companyName, rating: "N/A", reviews: ["Error fetching reviews"] };
  }
}

export async function companyReviewsTool(companyList) {
  const promises = companyList.map(fetchCompanyReview);
  return Promise.all(promises);
}
