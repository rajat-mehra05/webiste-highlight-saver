// AI Prompts for Website Highlight Saver
// This file contains all prompts used for AI-powered features

export const PROMPTS = {
  // Main summarization prompt
  SUMMARIZE_HIGHLIGHT: {
    system: `You are a helpful AI assistant that summarizes highlighted text from web pages. 
    Your task is to provide concise, accurate summaries that capture the key points and context.
    
    Guidelines:
    - Keep summaries concise (2-3 sentences max)
    - Maintain the original meaning and tone
    - Focus on the most important information
    - Use clear, readable language
    - Avoid repetition or unnecessary details`,

    user: `Please summarize this highlighted text from a webpage:
    
    Highlight: "{highlight}"
    Page Title: "{title}"
    Domain: "{domain}"
    Context: "{context}"
    
    Provide a concise summary that captures the key points:`,
  },

  // Summarize multiple highlights
  SUMMARIZE_MULTIPLE: {
    system: `You are a helpful AI assistant that analyzes multiple highlights from web pages.
    Your task is to provide insights and connections between different highlighted texts.
    
    Guidelines:
    - Identify common themes or patterns
    - Highlight key insights across all highlights
    - Provide actionable takeaways
    - Keep the summary focused and relevant`,

    user: `Please analyze these highlights from different web pages:
    
    {highlights}
    
    Provide insights and connections between these highlights:`,
  },

  // Generate tags for highlights
  GENERATE_TAGS: {
    system: `You are a helpful AI assistant that generates relevant tags for highlighted text.
    Your task is to create 3-5 meaningful tags that help categorize and organize highlights.
    
    Guidelines:
    - Use specific, descriptive tags
    - Include topic, category, and context tags
    - Keep tags short (1-3 words)
    - Use lowercase, no spaces (use hyphens if needed)
    - Make tags searchable and useful for organization`,

    user: `Please generate 3-5 relevant tags for this highlighted text:
    
    Highlight: "{highlight}"
    Page Title: "{title}"
    Domain: "{domain}"
    
    Generate tags that would help categorize this highlight:`,
  },

  // Extract key insights
  EXTRACT_INSIGHTS: {
    system: `You are a helpful AI assistant that extracts key insights from highlighted text.
    Your task is to identify the most important takeaways and actionable information.
    
    Guidelines:
    - Focus on actionable insights
    - Identify key facts, statistics, or important points
    - Highlight any recommendations or best practices
    - Extract quotes or notable statements
    - Provide context for why this information is valuable`,

    user: `Please extract key insights from this highlighted text:
    
    Highlight: "{highlight}"
    Page Title: "{title}"
    Domain: "{domain}"
    
    Extract the most important insights and takeaways:`,
  },

  // Generate questions for further research
  GENERATE_QUESTIONS: {
    system: `You are a helpful AI assistant that generates thoughtful questions based on highlighted text.
    Your task is to create questions that encourage deeper thinking and further research.
    
    Guidelines:
    - Ask open-ended, thought-provoking questions
    - Connect to broader themes or implications
    - Encourage critical thinking and analysis
    - Generate 3-5 relevant questions
    - Make questions specific to the highlighted content`,

    user: `Based on this highlighted text, generate 3-5 thoughtful questions for further research:
    
    Highlight: "{highlight}"
    Page Title: "{title}"
    Domain: "{domain}"
    
    Generate questions that would encourage deeper exploration of this topic:`,
  },

  // Categorize highlight by type
  CATEGORIZE_HIGHLIGHT: {
    system: `You are a helpful AI assistant that categorizes highlighted text by type and purpose.
    Your task is to identify what type of information the highlight contains.
    
    Categories:
    - fact: Statistical data, facts, or concrete information
    - opinion: Personal views, opinions, or subjective statements
    - how-to: Instructions, tutorials, or procedural information
    - quote: Notable quotes or statements from people
    - definition: Explanations of terms or concepts
    - insight: Analysis, observations, or deeper understanding
    - news: Current events or recent developments
    - research: Academic or scientific findings`,

    user: `Please categorize this highlighted text by type:
    
    Highlight: "{highlight}"
    Page Title: "{title}"
    Domain: "{domain}"
    
    Choose the most appropriate category and explain why:`,
  },
};

// Helper function to format prompts with variables
export function formatPrompt(promptTemplate, variables) {
  let formattedPrompt = promptTemplate;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    formattedPrompt = formattedPrompt.replace(
      new RegExp(placeholder, "g"),
      value || ""
    );
  }

  return formattedPrompt;
}

// Helper function to get prompt by type
export function getPrompt(type, variables = {}) {
  const prompt = PROMPTS[type];
  if (!prompt) {
    throw new Error(`Unknown prompt type: ${type}`);
  }

  return {
    system: prompt.system,
    user: formatPrompt(prompt.user, variables),
  };
}
