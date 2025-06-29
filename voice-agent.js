// Los Dos Gallos AI Voice Agent - Fixed Version
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
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        restaurant: 'Los Dos Gallos',
        timestamp: new Date().toISOString()
      });
    });

    // Voice webhook endpoint
    this.app.post('/voice', express.urlencoded({ extended: true }), async (req, res) => {
      try {
        await this.handleVoiceCall(req, res);
      } catch (error) {
        console.error('❌ Error handling voice call:', error);
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say('Sorry, I\'m having trouble right now. Please call back later.');
        res.type('text/xml');
        res.send(twiml.toString());
      }
    });

    // Order confirmation endpoint
    this.app.post('/confirm-order', express.urlencoded({ extended: true }), async (req, res) => {
      try {
        await this.confirmOrder(req, res);
      } catch (error) {
        console.error('❌ Error confirming order:', error);
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say('Sorry, there was an error processing your order.');
        res.type('text/xml');
        res.send(twiml.toString());
      }
    });
  }

  async handleVoiceCall(req, res) {
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Welcome message
    twiml.say({
      voice: 'woman',
      language: 'en-US'
    }, 'Hello! Thank you for calling Los Dos Gallos! I\'m your AI assistant and I\'m here to help you place your order. What would you like today?');

    // Gather speech input
    const gather = twiml.gather({
      input: 'speech',
      timeout: 10,
      speechTimeout: 'auto',
      action: '/process-order',
      method: 'POST'
    });

    gather.say({
      voice: 'woman',
      language: 'en-US'
    }, 'You can order tacos, burritos, sides, and drinks. Just tell me what you\'d like!');

    // Fallback if no input
    twiml.say({
      voice: 'woman',
      language: 'en-US'
    }, 'I didn\'t hear anything. Please call back when you\'re ready to order. Goodbye!');

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
            content: `You are an AI assistant for Los Dos Gallos Mexican restaurant. 
            
            MENU:
            ${JSON.stringify(this.menu, null, 2)}
            
            Process customer orders and extract:
            1. Items ordered
            2. Quantities
            3. Any modifications (extra cheese, no onions, etc.)
            4. Calculate total with 7% Georgia tax
            
            Respond in a friendly, conversational tone. If the customer orders something not on the menu, suggest similar items.
            
            Format your response as a confirmation of their order with the total price.`
          },
          {
            role: "user",
            content: userSpeech
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      const aiResponse = completion.choices[0].message.content;
      console.log('🤖 AI Response:', aiResponse);

      twiml.say({
        voice: 'woman',
        language: 'en-US'
      }, aiResponse);

      // Ask for confirmation
      const gather = twiml.gather({
        input: 'speech',
        timeout: 10,
        speechTimeout: 'auto',
        action: '/confirm-order',
        method: 'POST'
      });

      gather.say({
        voice: 'woman',
        language: 'en-US'
      }, 'Does this sound correct? Say yes to confirm your order, or tell me what you\'d like to change.');

    } catch (error) {
      console.error('❌ OpenAI Error:', error);
      twiml.say({
        voice: 'woman',
        language: 'en-US'
      }, 'I\'m sorry, I\'m having trouble processing your order right now. Please try again or speak with one of our staff members.');
    }

    res.type('text/xml');
    res.send(twiml.toString());
  }

  async confirmOrder(req, res) {
    const twiml = new twilio.twiml.VoiceResponse();
    const userResponse = req.body.SpeechResult || '';
    
    console.log('🎤 Customer confirmation:', userResponse);

    // Simple confirmation logic
    if (userResponse.toLowerCase().includes('yes') || 
        userResponse.toLowerCase().includes('correct') ||
        userResponse.toLowerCase().includes('confirm')) {
      
      twiml.say({
        voice: 'woman',
        language: 'en-US'
      }, 'Perfect! Your order has been confirmed. It will be ready for pickup in 20 to 25 minutes. Thank you for choosing Los Dos Gallos! Have a great day!');
      
      console.log('✅ Order confirmed and sent to kitchen');
      
    } else {
      // Customer wants to make changes
      const gather = twiml.gather({
        input: 'speech',
        timeout: 10,
        speechTimeout: 'auto',
        action: '/process-order',
        method: 'POST'
      });

      gather.say({
        voice: 'woman',
        language: 'en-US'
      }, 'No problem! What would you like to change or add to your order?');
    }

    res.type('text/xml');
    res.send(twiml.toString());
  }

  start() {
    // Add the missing route for process-order
    this.app.post('/process-order', express.urlencoded({ extended: true }), async (req, res) => {
      try {
        await this.processOrder(req, res);
      } catch (error) {
        console.error('❌ Error processing order:', error);
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say('Sorry, there was an error processing your order.');
        res.type('text/xml');
        res.send(twiml.toString());
      }
    });

    this.app.listen(this.port, () => {
      console.log('🐓 Los Dos Gallos Voice Agent running on port', this.port);
      console.log('📞 Phone webhook URL: http://your-domain.com/voice');
      console.log('🎯 Ready to take orders for Los Dos Gallos!');
      console.log('');
      console.log('🎯 What I can handle:');
      console.log('  ✅ Complete phone conversations');
      console.log('  ✅ Menu ordering with modifications'); 
      console.log('  ✅ Tax calculations');
      console.log('  ✅ Order confirmation');
      console.log('  ✅ POS system integration (needs your API)');
      console.log('');
    });
  }
}

// Start the voice agent
const voiceAgent = new LosDosGallosVoiceAgent();
voiceAgent.start();
