// Los Dos Gallos AI Voice Agent - Stable Version
const express = require('express');
const twilio = require('twilio');
const OpenAI = require('openai');

class LosDosGallosVoiceAgent {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // Initialize OpenAI
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Initialize Twilio
    this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Menu data
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
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());

    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        restaurant: 'Los Dos Gallos',
        voice: 'Amazon Polly - Joanna',
        timestamp: new Date().toISOString()
      });
    });

    this.app.post('/voice', (req, res) => {
      const twiml = new twilio.twiml.VoiceResponse();
      
      twiml.say({
        voice: 'Polly.Joanna',
        language: 'en-US'
      }, 'Hello! Thank you for calling Los Dos Gallos! I\'m Maria, and I\'m here to help you place your order. What can I get started for you today?');

      const gather = twiml.gather({
        input: 'speech',
        timeout: 8,
        speechTimeout: 2,
        action: '/process-order',
        method: 'POST',
        language: 'en-US'
      });

      gather.say({
        voice: 'Polly.Joanna',
        language: 'en-US'
      }, 'What would you like to order?');

      twiml.say({
        voice: 'Polly.Joanna',
        language: 'en-US'
      }, 'I didn\'t hear anything. Please call back when you\'re ready to order. Goodbye!');

      res.type('text/xml');
      res.send(twiml.toString());
    });

    this.app.post('/process-order', async (req, res) => {
      const twiml = new twilio.twiml.VoiceResponse();
      const userSpeech = req.body.SpeechResult || '';
      
      console.log('🎤 Customer said:', userSpeech);

      try {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are Maria, an AI order-taker for Los Dos Gallos Mexican restaurant.
              
              MENU:
              ${JSON.stringify(this.menu, null, 2)}
              
              INSTRUCTIONS:
              1. Take orders without asking "is that correct" after each item
              2. When they say "that's all" or "that's it" - give them the total with 7% Georgia tax and read back their complete order
              3. Just acknowledge each item with "Got it" or "Okay"
              4. Only ask for confirmation at the very end
              
              RESPONSE FORMAT when order is complete:
              "I have [items with quantities]. Your total is $[amount] with tax. Is that correct?"
              
              Do NOT suggest items. Just take what they order.`
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

        twiml.say({
          voice: 'Polly.Joanna',
          language: 'en-US'
        }, aiResponse);

        const gather = twiml.gather({
          input: 'speech',
          timeout: 8,
          speechTimeout: 2,
          action: '/confirm-order',
          method: 'POST',
          language: 'en-US'
        });

        gather.say({
          voice: 'Polly.Joanna',
          language: 'en-US'
        }, 'Is that correct?');

      } catch (error) {
        console.error('❌ OpenAI Error:', error);
        twiml.say({
          voice: 'Polly.Joanna',
          language: 'en-US'
        }, 'I\'m sorry, I\'m having trouble processing your order right now.');
      }

      res.type('text/xml');
      res.send(twiml.toString());
    });

    this.app.post('/confirm-order', (req, res) => {
      const twiml = new twilio.twiml.VoiceResponse();
      const userResponse = req.body.SpeechResult || '';
      
      console.log('🎤 Customer confirmation:', userResponse);

      if (userResponse.toLowerCase().includes('yes') || 
          userResponse.toLowerCase().includes('correct') ||
          userResponse.toLowerCase().includes('right') ||
          userResponse.toLowerCase().includes('ok') ||
          userResponse.toLowerCase().includes('good')) {
        
        twiml.say({
          voice: 'Polly.Joanna',
          language: 'en-US'
        }, 'Perfect! Your order has been confirmed and sent to our kitchen. It will be ready for pickup in 20 to 25 minutes at Los Dos Gallos. Thank you for choosing us!');
        
        console.log('✅ Order confirmed');
        
      } else {
        const gather = twiml.gather({
          input: 'speech',
          timeout: 8,
          speechTimeout: 2,
          action: '/process-order',
          method: 'POST',
          language: 'en-US'
        });

        gather.say({
          voice: 'Polly.Joanna',
          language: 'en-US'
        }, 'What would you like to change?');
      }

      res.type('text/xml');
      res.send(twiml.toString());
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log('🐓 Los Dos Gallos Voice Agent running on port', this.port);
      console.log('🎤 Voice: Amazon Polly - Joanna (Clear pronunciation)');
      console.log('📞 Ready to take orders!');
    });
  }
}

const voiceAgent = new LosDosGallosVoiceAgent();
voiceAgent.start();
