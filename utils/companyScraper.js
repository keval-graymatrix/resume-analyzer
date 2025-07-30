import axios from "axios";

export const getCompanyReviewFromSerpAPI = async (companyName) => {
  const apiKey = process.env.SERPAPI_KEY;
  try {
    const response = await axios.get("https://serpapi.com/search.json", {
      params: {
        engine: "google",
        q: `${companyName} company reviews site:glassdoor.com`,
        api_key: apiKey,
      },
    });

    const result = response.data.organic_results?.[0];

    const reviews = result?.snippet?.split(".").slice(0, 2) || ["No reviews found"];
    const ratingMatch = result?.snippet?.match(/([0-5]\.?[0-9]?)\s*stars?/i);
    const rating = ratingMatch ? ratingMatch[1] : "N/A";

    return {
      rating,
      reviews
    };
  } catch (err) {
    console.error("Error fetching company reviews", err);
    return {
      rating: "N/A",
      reviews: ["Error fetching reviews"]
    };
  }
};
