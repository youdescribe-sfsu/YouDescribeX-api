import { OpenAI } from 'openai';
import { OPENAI_API_KEY } from '../config';
const BATCH_SIZE = 30;

const openai = new OpenAI({
  apiKey: `${OPENAI_API_KEY}`,
});

type IWishList = {
  youtube_id: string;
  category: string;
  category_id: number;
  created_at: number;
  duration: number;
  status: string;
  tags: string[];
  updated_at: number;
  votes: Number;
  youtube_status: string;
};

type RelevanceScoreResult = IWishList & {
  relevance_score: number;
};

const getRelevanceScores = async (items: IWishList[], keyword: string, category: string): Promise<RelevanceScoreResult[]> => {
  const scoredItems: RelevanceScoreResult[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    const prompt = `
      I have a list of YouTube videos, and each video has a youtube_id and a list of tags. I want you to rank the relevance of each video to this keyword: "${keyword}"${
      category ? ` and this category "${category}"` : ''
    }. In addition to considering individual tags, you need to take into account how the tags combine to form an overall context for the video. For each video, provide a relevance score between 1 and 10, where 1 is "not relevant at all" and 10 is "highly relevant". Here is the data:

      Videos:
      ${batch
        .map((item, index) => {
          return `${index + 1}. youtube_id: "${item.youtube_id}", tags: ${JSON.stringify(item.tags)}`;
        })
        .join('\n')}

      Please return the result as a valid string array of objects in this exact format and Do NOT provide any explanation or additional text.:
            [
              {"youtube_id": "<youtube_id>", "relevance_score": "<relevance_score>" },
              {"youtube_id": "<youtube_id>", "relevance_score": "<relevance_score>" }
            ]
      Ensure that each video in the list has a corresponding entry in the response array, even if the relevance_score is set to 1 for videos with missing tags or incomplete data.
      `;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a ranking system.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4000,
      });

      const responseContent = response.choices[0].message.content;
      const parsedResponse: { youtube_id: string; relevance_score: number }[] = JSON.parse(responseContent);

      const relevanceMap = new Map(parsedResponse.map(item => [item.youtube_id, item.relevance_score]));

      // Merge the relevance scores back to the original items
      const batchWithScores: RelevanceScoreResult[] = batch.map(item => ({
        ...item,
        relevance_score: relevanceMap.get(item.youtube_id) || 1,
      }));

      scoredItems.push(...batchWithScores);
    } catch (err) {
      console.error('Error:', err.message);
      const batchWithScores: RelevanceScoreResult[] = batch.map(item => ({
        ...item,
        relevance_score: 1,
      }));

      scoredItems.push(...batchWithScores);
    }
  }
  const sortedItems: RelevanceScoreResult[] = scoredItems.sort((a, b) => b.relevance_score - a.relevance_score);
  return sortedItems;
};

export default getRelevanceScores;
