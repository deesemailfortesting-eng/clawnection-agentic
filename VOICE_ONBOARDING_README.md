# Voice Onboarding Integration

This page integrates Vapi for voice-based user onboarding in the Clawnection app.

## Setup Instructions

1. **Install Vapi SDK** (already done):
   ```bash
   npm install @vapi-ai/web
   ```

2. **Get Vapi API Key**:
   - Sign up at [Vapi.ai](https://vapi.ai)
   - Create an API key in your dashboard

3. **Get 11Labs Voice ID** (for voice synthesis):
   - Sign up at [11Labs](https://elevenlabs.io)
   - Create a voice and get the voice ID

4. **Set Environment Variables**:
   Create a `.env.local` file in the project root:
   ```
   NEXT_PUBLIC_VAPI_API_KEY=your_actual_vapi_api_key
   NEXT_PUBLIC_VAPI_VOICE_ID=your_11labs_voice_id
   ```

5. **Restart the development server**:
   ```bash
   npm run dev
   ```

## How It Works

- Users click "Start Voice Onboarding" to begin a voice call
- The Vapi assistant asks conversational questions to collect profile information
- After collecting all data, the assistant outputs a JSON summary
- The profile is saved to localStorage and user is redirected to the demo

## Features

- Conversational onboarding experience
- Collects all the same information as the text form
- Error handling and call management
- Fallback to text onboarding

## Current Status

- ✅ Page created and integrated
- ✅ Vapi SDK installed
- ✅ Basic conversation flow implemented
- ⚠️ Requires API keys to function
- ⚠️ Data extraction uses simple JSON parsing (could be improved with better NLP)

## Next Steps

1. Set up Vapi account and get API keys
2. Test the voice interaction
3. Improve data extraction (perhaps use Vapi's structured conversation features)
4. Add more sophisticated error handling
5. Consider adding voice recording/transcription fallbacks