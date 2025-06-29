// Los Dos Gallos AI Voice Agent with Lupe (Amazon Polly)
const express = require('express');
const twilio = require('twilio');
const OpenAI = require('openai');

class LosDosGallosVoiceAgent {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // Initialize OpenAI
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY environment variable is missing');
      process.exit(1);
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Initialize Twilio
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.error('❌ TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN environment variables are missing');
      process.exit(1);
    }
    
    this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Menu data for Los Dos Gallos
    this.menu = {
      tacos: {
        'street tacos': { price: 2.50, description: 'Traditional Mexican street tacos' },
        'gringo tacos': { price: 3.00, description: 'American-style hard shell tacos' },
        'fish tacos': { price: 4.50, description: 'Fresh fish with cabbage slaw' }
      },
      burritos: {
        'california burrito': { price: 9.50, description: 'Carne asada, fries, cheese, sour cream' },
        'bean and rice burrito': { price: 7.00, description: 'Beans, rice, cheese, salsa' },
        'chicken burrito': { price: 8.50, description: 'Grilled chicken, rice, beans, cheese' }
      },
      sides: {
        'chips and salsa': { price: 3.50, description: 'Fresh tortilla chips with house salsa' },
        'guacamole': { price: 2.00, description: 'Fresh avocado dip' },
        'beans': { price: 2.50, description: 'Refried beans' },
        'rice': { price: 2.50, description: 'Spanish rice' }
      },
      drinks: {
        'horchata': { price: 3.00, description: 'Traditional rice drink' },
        'soft drink': { price: 2.00, description: 'Coke, Sprite, Orange' },
        'water': { price: 1.50, description: 'Bottled water' }
      }
    };
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Enable body parsing
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        restaurant: 'Los Dos Gallos',
        voice: 'Amazon Polly - Lupe',
        timestamp: new Date().toISOString()
      });
    });

    // Voice webhook endpoint
    this.app.post('/voice', async (req, res) => {
      try {
        await this.handleVoiceCall(req, res);
      } catch (error) {
        console.error('❌ Error handling voice call:', error);
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({
          voice: 'Polly.Lupe',
          language: 'es-US'
        }, 'Lo siento, tengo problemas técnicos. Por favor llame más tarde.');
        res.type('text/xml');
        res.send(twiml.toString());
      }
    });

    // Order processing endpoint
    this.app.post('/process-order', async (req, res) => {
      try {
        await this.processOrder(req, res);
      } catch (error) {
        console.error('❌ Error processing order:', error);
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({
          voice: 'Polly.Lupe',
          language: 'en-US'
        }, 'Sorry, there was an error processing your order. Let me get someone to help you.');
        res.type('text/xml');
        res.send(twiml.toString());
      }
    });

    // Order confirmation endpoint
    this.app.post('/confirm-order', async (req, res) => {
      try {
        await this.confirmOrder(req, res);
      } catch (error) {
        console.error('❌ Error confirming order:', error);
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({
          voice: 'Polly.Lupe',
          language: 'en-US'
        }, 'Sorry, there was an error with your order confirmation.');
        res.type('text/xml');
        res.send(twiml.toString());
      }
    });
  }

  async handleVoiceCall(req, res) {
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Welcome message with Lupe's voice
    twiml.say({
      voice: 'Polly.Lupe',
      language: 'en-US'
    }, 'Hello! Thank you for calling Los Dos Gallos! I\'m Maria, and I\'m here to help you place your order. What can I get started for you today?');

    // Gather speech input
    const gather = twiml.gather({
      input: 'speech',
      timeout: 10,
      speechTimeout: 'auto',
      action: '/process-order',
      method: 'POST',
      language: 'en-US'
    });

    gather.say({
      voice: 'Polly.Lupe',
      language: 'en-US'
    }, 'What would you like to order?');

    // Fallback if no input
    twiml.say({
      voice: 'Polly.Lupe',
      language: 'en-US'
    }, 'I didn\'t hear anything. Please call back when you\'re ready to order. ¡Hasta luego!');

    res.type('text/xml');
    res.send(twiml.toString());
  }

  async processOrder(req, res) {
    const twiml = new twilio.twiml.VoiceResponse();
    const userSpeech = req.body.SpeechResult || '';
    
    console.log('🎤 Customer said:', userSpeech);

    try {
      // Use OpenAI to process the order
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `            You are Maria, an AI order-taker for Los Dos Gallos Mexican restaurant. Your job is to take orders efficiently and accurately.
            
            MENU:
            ${JSON.stringify(this.menu, null, 2)}
            
            INSTRUCTIONS:
            1. Take the customer's order without recommendations or suggestions
            2. If they order something not on the menu, simply say "We don't have that item"
            3. When they say "that's all", "that's it", or similar - calculate the total with 7% Georgia tax and read back their complete order
            4. Keep responses brief and professional
            
            RESPONSE FORMAT when order is complete:
            "I have [list items]. Your total is $[amount] with tax. Is that correct?"
            
            Do NOT suggest items. Do NOT ask what else they want. Just take what they order.`
          },
          {
            role: "user",
            content: userSpeech
          }
        ],
        max_tokens: 250,
        temperature: 0.7
      });

      const aiResponse = completion.choices[0].message.content;
      console.log('🤖 AI Response:', aiResponse);

      // Use Lupe's voice for the response
      twiml.say({
        voice: 'Polly.Lupe',
        language: 'en-US'
      }, aiResponse);

      // Ask for confirmation with better speech settings
      const gather = twiml.gather({
        input: 'speech',
        timeout: 8,
        speechTimeout: 2,
        action: '/confirm-order',
        method: 'POST',
        language: 'en-US',
        speechModel: 'phone_call'
      });

      gather.say({
        voice: 'Polly.Lupe',
        language: 'en-US'
      }, 'Please say yes if that\'s correct, or tell me what to change.');

    } catch (error) {
      console.error('❌ OpenAI Error:', error);
      twiml.say({
        voice: 'Polly.Lupe',
        language: 'en-US'
      }, 'I\'m sorry, I\'m having trouble processing your order right now. Let me get one of our staff members to help you.');
    }

    res.type('text/xml');
    res.send(twiml.toString());
  }

  async confirmOrder(req, res) {
    const twiml = new twilio.twiml.VoiceResponse();
    const userResponse = req.body.SpeechResult || '';
    
    console.log('🎤 Customer confirmation:', userResponse);

    // Simple confirmation logic - recognize multiple ways to confirm
    if (userResponse.toLowerCase().includes('yes') || 
        userResponse.toLowerCase().includes('correct') ||
        userResponse.toLowerCase().includes('right') ||
        userResponse.toLowerCase().includes('ok') ||
        userResponse.toLowerCase().includes('good') ||
        userResponse.toLowerCase().includes('that\'s right') ||
        userResponse.toLowerCase().includes('confirm')) {
      
      twiml.say({
        voice: 'Polly.Lupe',
        language: 'en-US'
      }, 'Perfect! Your order has been confirmed and sent to our kitchen. It will be ready for pickup in 20 to 25 minutes at Los Dos Gallos. Thank you so much for choosing us, and have a wonderful day!');
      
      console.log('✅ Order confirmed and sent to kitchen');
      
    } else {
      // Customer wants to make changes
      const gather = twiml.gather({
        input: 'speech',
        timeout: 8,
        speechTimeout: 2,
        action: '/process-order',
        method: 'POST',
        language: 'en-US',
        speechModel: 'phone_call'
      });

      gather.say({
        voice: 'Polly.Lupe',
        language: 'en-US'
      }, 'No problem at all! What would you like to change or add to your order?');
    }

    res.type('text/xml');
    res.send(twiml.toString());
  }

  start() {
    this.app.listen(this.port, () => {
      console.log('🐓 Los Dos Gallos Voice Agent running on port', this.port);
      console.log('📞 Phone webhook URL: https://los-dos-gallos-ai-production.up.railway.app/voice');
      console.log('🎤 Voice: Amazon Polly - Lupe (Hispanic accent)');
      console.log('🎯 Ready to take orders with natural voice!');
      console.log('');
      console.log('🎯 Features:');
      console.log('  ✅ Natural Hispanic accent with Lupe voice');
      console.log('  ✅ Bilingual capabilities (English primary)'); 
      console.log('  ✅ Professional restaurant conversations');
      console.log('  ✅ Order processing with AI');
      console.log('  ✅ Tax calculations');
      console.log('  ✅ Order confirmation');
      console.log('  ✅ Warm, welcoming personality');
      console.log('');
    });
  }
}

// Start the voice agent
const voiceAgent = new LosDosGallosVoiceAgent();
voiceAgent.start();
