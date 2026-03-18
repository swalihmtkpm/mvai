import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY!;

export const getGeminiPro = () => {
  // Always use the latest available key (API_KEY is for user-selected keys)
  const key = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
  const ai = new GoogleGenAI({ apiKey: key });
  return ai;
};

const handleGeminiError = (error: any) => {
  console.error("Gemini API Error:", error);
  const errorBody = error?.message || "";
  
  if (errorBody.includes("429") || errorBody.includes("RESOURCE_EXHAUSTED") || errorBody.includes("quota")) {
    return "MeemVa: I've reached my temporary usage limit (Quota Exceeded). Please try again in a moment or wait a short while.";
  }
  return `MeemVa: I encountered an error: ${errorBody || "Unknown error"}. Please try again.`;
};

const cleanHistory = (history: any[]) => {
  const formatted = history
    .filter(h => h.content && h.content.trim() !== "")
    .map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));

  // Gemini history must start with 'user' and alternate.
  // If we slice and it starts with 'model', we drop it.
  let result = formatted.slice(-50); // Increase to 50 messages for better context
  while (result.length > 0 && result[0].role !== 'user') {
    result.shift();
  }

  // Ensure alternating roles (User -> Model -> User -> Model)
  const alternating: any[] = [];
  result.forEach((msg, i) => {
    if (i === 0 || msg.role !== alternating[alternating.length - 1].role) {
      alternating.push(msg);
    }
  });

  return alternating;
};

export const generateTextStream = async (prompt: string, history: any[] = [], onChunk: (chunk: string) => void) => {
  try {
    const ai = getGeminiPro();
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "You are MeemVa. You are a model trained by MeemVa. Be extremely brief, direct, and fast. No conversational filler.",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      },
      history: cleanHistory(history)
    });

    const result = await chat.sendMessageStream({ message: prompt });
    let fullText = "";
    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(fullText);
      }
    }
    return fullText;
  } catch (error) {
    const errorMsg = handleGeminiError(error);
    onChunk(errorMsg);
    return errorMsg;
  }
};

export const generateMultimodalStream = async (prompt: string, files: { data: string, mimeType: string }[], history: any[] = [], onChunk: (chunk: string) => void) => {
  try {
    const ai = getGeminiPro();
    
    const contextHistory = cleanHistory(history);
    
    // For generateContentStream, the last message in contents must be the current user turn.
    // So if contextHistory ends with a user message, we must remove it or the API will fail 
    // because it expects alternating roles and the next one we add is also 'user'.
    if (contextHistory.length > 0 && contextHistory[contextHistory.length - 1].role === 'user') {
      contextHistory.pop();
    }

    const mediaParts: any[] = files.map(f => ({
      inlineData: {
        data: f.data.split(',')[1],
        mimeType: f.mimeType
      }
    }));
    mediaParts.push({ text: prompt || "Analyze" });

    const result = await ai.models.generateContentStream({
      model: "gemini-3.1-pro-preview",
      contents: [
        ...contextHistory,
        { role: 'user', parts: mediaParts }
      ],
      config: {
        systemInstruction: "You are MeemVa. You are a model trained by MeemVa. Be extremely brief and fast. Analyze media (images, videos) concisely and accurately.",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    let fullText = "";
    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(fullText);
      }
    }
    return fullText;
  } catch (error) {
    const errorMsg = handleGeminiError(error);
    onChunk(errorMsg);
    return errorMsg;
  }
};

export const generateText = async (prompt: string, history: any[] = [], systemInstruction: string = "") => {
  try {
    const ai = getGeminiPro();
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: systemInstruction || "You are MeemVa. You are a model trained by MeemVa. Always reply with the name MeemVa.",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      },
      history: cleanHistory(history)
    });

    const result = await chat.sendMessage({ message: prompt });
    return result.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    return handleGeminiError(error);
  }
};

export const generateImage = async (prompt: string, aspectRatio: string = "1:1") => {
  const ai = getGeminiPro();
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const generateVideo = async (prompt: string, aspectRatio: "16:9" | "9:16" = "16:9") => {
  const currentKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
  const ai = new GoogleGenAI({ apiKey: currentKey });
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed");

  const response = await fetch(downloadLink, {
    method: 'GET',
    headers: { 'x-goog-api-key': currentKey },
  });
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const generateMultimodal = async (prompt: string, files: { data: string, mimeType: string }[], history: any[] = []) => {
  try {
    const ai = getGeminiPro();
    
    const contextHistory = cleanHistory(history);
    
    if (contextHistory.length > 0 && contextHistory[contextHistory.length - 1].role === 'user') {
      contextHistory.pop();
    }

    const mediaParts: any[] = files.map(f => ({
      inlineData: {
        data: f.data.split(',')[1],
        mimeType: f.mimeType
      }
    }));
    mediaParts.push({ text: prompt || "Analyze this image" });

    const result = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        ...contextHistory,
        { role: 'user', parts: mediaParts }
      ],
      config: {
        systemInstruction: "You are MeemVa, a sophisticated AI assistant. Always reply with the name MeemVa. Analyze the provided media carefully and provide concise, direct insights.",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    return result.text || "I'm sorry, I couldn't analyze the media.";
  } catch (error) {
    return handleGeminiError(error);
  }
};
export const generateSpeech = async (text: string) => {
  const ai = getGeminiPro();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    return `data:audio/mpeg;base64,${base64Audio}`;
  }
  throw new Error("Speech generation failed");
};
