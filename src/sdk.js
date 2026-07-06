export class KrimsCodeClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async health() {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      if (!response.ok) throw new Error('API offline');
      return await response.json();
    } catch (err) {
      return { ok: false, status: 'error', error: err.message };
    }
  }

  async executePrompt(prompt, options = {}) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        model: options.model || 'krims-local',
        systemInstruction: options.systemInstruction || '',
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        maxTokens: options.maxTokens !== undefined ? options.maxTokens : 512,
        history: options.history || []
      })
    });

    if (!response.ok) {
      throw new Error(`Krims Code API responded with code: ${response.status}`);
    }

    return await response.json();
  }
}
