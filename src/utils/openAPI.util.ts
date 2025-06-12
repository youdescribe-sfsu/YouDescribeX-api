import { OpenAI } from 'openai';
import { OPENAI_API_KEY } from '../config';
import { logger } from './logger'; // Using your existing logger

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
      You must respond with ONLY a valid JSON array. I have a list of YouTube videos, and each video has a youtube_id and a list of tags. I want you to rank the relevance of each video to this keyword: "${keyword}"${
      category ? ` and this category "${category}"` : ''
    }. In addition to considering individual tags, you need to take into account how the tags combine to form an overall context for the video. For each video, provide a relevance score between 1 and 10, where 1 is "not relevant at all" and 10 is "highly relevant".

      Videos:
      ${batch
        .map((item, index) => {
          return `${index + 1}. youtube_id: "${item.youtube_id}", tags: ${JSON.stringify(item.tags)}`;
        })
        .join('\n')}

      Respond with ONLY the JSON array below. No markdown, no code blocks, no explanations:
            [
              {"youtube_id": "youtube_id_here", "relevance_score": 5},
              {"youtube_id": "youtube_id_here", "relevance_score": 7}
            ]
      `;

    let response;
    try {
      response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a JSON-only ranking system. Respond only with valid JSON arrays. Never use markdown or explanations.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4000,
      });

      const responseContent = response.choices[0].message.content;

      if (!responseContent) {
        logger.error('Empty response from OpenAI for relevance scoring');
        // Fallback: assign default scores to this batch
        const fallbackBatch: RelevanceScoreResult[] = batch.map(item => ({
          ...item,
          relevance_score: 1,
        }));
        scoredItems.push(...fallbackBatch);
        continue;
      }

      // Clean the response content
      let cleanedContent = responseContent.trim();

      // Remove markdown code blocks if present
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Remove any leading/trailing backticks
      cleanedContent = cleanedContent.replace(/^`+|`+$/g, '');

      if (!cleanedContent) {
        logger.error('Empty content after cleaning OpenAI response');
        // Fallback: assign default scores to this batch
        const fallbackBatch: RelevanceScoreResult[] = batch.map(item => ({
          ...item,
          relevance_score: 1,
        }));
        scoredItems.push(...fallbackBatch);
        continue;
      }

      const parsedResponse: { youtube_id: string; relevance_score: number }[] = JSON.parse(cleanedContent);

      // Validate parsed response
      if (!Array.isArray(parsedResponse)) {
        throw new Error('OpenAI response is not an array');
      }

      const relevanceMap = new Map(parsedResponse.map(item => [item.youtube_id, item.relevance_score]));

      // Merge the relevance scores back to the original items
      const batchWithScores: RelevanceScoreResult[] = batch.map(item => ({
        ...item,
        relevance_score: relevanceMap.get(item.youtube_id) || 1,
      }));

      scoredItems.push(...batchWithScores);

      logger.info(`Successfully processed batch ${Math.floor(i / BATCH_SIZE) + 1} for relevance scoring`);
    } catch (err) {
      logger.error('Error parsing OpenAI response for relevance scoring:', {
        error: err.message,
        rawResponse: response?.choices?.[0]?.message?.content,
        batchSize: batch.length,
        keyword,
        category,
      });

      // Fallback: assign default scores to this batch
      const fallbackBatch: RelevanceScoreResult[] = batch.map(item => ({
        ...item,
        relevance_score: 1,
      }));
      scoredItems.push(...fallbackBatch);
    }
  }

  const sortedItems: RelevanceScoreResult[] = scoredItems.sort((a, b) => b.relevance_score - a.relevance_score);

  logger.info(`Relevance scoring completed for ${sortedItems.length} items with keyword: "${keyword}"`);

  return sortedItems;
};

export default getRelevanceScores;
