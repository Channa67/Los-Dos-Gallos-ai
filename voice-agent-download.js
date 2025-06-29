// Los Dos Gallos AI Voice Agent - Core System
// Complete restaurant phone ordering system

const express = require('express');
const twilio = require('twilio');
const OpenAI = require('openai');

class LosDosGallosVoiceAgent {
  constructor() {
    this.app = express();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Los Dos Gallos Menu Data
    this.menu = {
      appetizers: [
        { id: 'guac', name: 'Fresh Guacamole', price: 8.99, description: 'Fresh chunks of avocado with pico de gallo and lime juice' },
        { id: 'wings', name: 'Buffalo Wings', price: 12.99, description: '8 pieces with fries, mild, hot or buffalo' },
        { id: 'sampler', name: 'Sampler Platter', price: 14.99, description: 'Cheese dip, guacamole dip, sour cream, mozzarella sticks, jalapeño peppers, cheese quesadilla' }
      ],
      tacos: [
        { id: 'street-tacos', name: 'Street Tacos', price: 9.99, description: 'Served in corn tortilla, onions, cilantro and sauce' },
        { id: 'soft-tacos', name: 'Soft Tacos', price: 11.99, description: 'Three soft tacos, meat choice, served with rice, beans, pico de gallo' },
        { id: 'carne-asada-tacos', name: 'Tacos de Carne Asada', price: 13.99, description: 'Three steak soft tacos cooked with hot sauce, served with rice, beans and pico de gallo' }
      ],
      burritos: [
        { id: 'california-burrito', name: 'California Burrito', price: 12.99, description: 'Grilled chicken or steak mixed with rice, beans, lettuce, sour cream and pico de gallo' },
        { id: 'fish-shrimp-burrito', name: 'Fish and Shrimp Burrito', price: 15.99, description: 'Big burrito stuffed with fish and shrimp and pico de gallo, topped with green sauce and cheese dip' },
        { id: 'burrito-supreme', name: 'Burrito Supreme', price: 11.99, description: 'Beef burrito topped with red sauce, lettuce, tomato, shredded cheese and sour cream, served with rice' }
      ],
      enchiladas: [
        { id: 'chicken-enchiladas', name: 'Chicken Enchiladas', price: 12.99, description: 'Three chicken enchiladas topped with green sauce, served with rice, pico de gallo' },
        { id: 'enchiladas-supremas', name: 'Enchiladas Supremas', price: 13.99, description: 'Combination of 4 enchiladas (chicken, beef, cheese, beans) served with lettuce, tomato, sour cream' },
        { id: 'enchiladas-verdes', name: 'Enchiladas Verdes', price: 12.99, description: 'Three chicken enchiladas topped with green sauce, served with rice, pico de gallo, and guacamole salad' }
      ],
      quesadillas: [
        { id: 'fajita-quesadilla', name: 'Fajita Quesadilla', price: 13.99, description: 'Stuffed with grilled steak, chicken, shrimp, onions and bell peppers' },
        { id: 'quesadilla-rellena', name: 'Quesadilla Rellena', price: 11.99, description: 'Two quesadillas stuffed with grilled chicken or steak, served with sour cream and pico de gallo' }
      ],
      specialties: [
        { id: 'carnitas', name: 'Carnitas', price: 14.99, description: 'Grilled pork chunks served rice, beans, guacamole salad and tortillas' },
        { id: 'carne-asada', name: 'Carne Asada', price: 16.99, description: 'Two savory steak slices cooked with onions, served with rice, beans, guacamole salad and chile toreado' },
        { id: 'pollo-ranchero', name: 'Pollo Ranchero', price: 13.99, description: 'Grilled chicken strips topped with cheese ranchero sauce, served with rice, beans, guacamole salad' }
      ],
      beverages: [
        { id: 'soft-drink', name: 'Soft Drink', price: 2.99, description: 'Coke, Pepsi, Sprite, Orange, Dr Pepper' },
        { id: 'horchata', name: 'Horchata', price: 3.99, description: 'Traditional rice and cinnamon drink' },
        { id: 'agua-fresca', name: 'Agua Fresca', price: 3.99, description: 'Fresh fruit water' },
        { id: 'coffee', name: 'Coffee', price: 2.49, description: 'Fresh brewed coffee' }
      ]
    };

    this.restaurantInfo = {
      name: 'Los Dos Gallos',
      phone: '(229) 890-9426',
      address: '2205 1st Ave SE, Moultrie, GA 31788',
      hours: {
        sunday: '11:00 AM - 9:00 PM',
        monday: 'CLOSED',
        tuesday: '11:00 AM - 9:00 PM',
        wednesday: '11:00 AM - 9:00 PM',
        thursday: '11:00 AM - 9:00 PM',
        friday: '11:00 AM - 10:00 PM',
        saturday: '11:00 AM - 10:00 PM'
      },
      taxRate: 0.07, // 7% Georgia tax
      averagePickupTime: '20-25 minutes'
    };

    this.setupRoutes();
    this.currentOrders = new Map(); // Store active orders by call SID
  }

  setupRoutes() {
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());

    // Twilio webhook for incoming calls
    this.app.post('/voice', this.handleIncomingCall.bind(this));
    
    // Process speech input
    this.app.post('/process-speech', this.processSpeech.bind(this));
    
    // Handle order confirmation
    this.app.post('/confirm-order', this.confirmOrder.bind(this));
    
    // Order status endpoint
    this.app.get('/orders/:callSid', this.getOrderStatus.bind(this));
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', restaurant: this.restaurantInfo.name });
    });
  }

  handleIncomingCall(req, res) {
    const twiml = new twilio.twiml.VoiceResponse();
    const callSid = req.body.CallSid;
    
    // Initialize order for this call
    this.currentOrders.set(callSid, {
      items: [],
      customerInfo: {},
      total: 0,
      status: 'taking_order'
    });

    // Greeting
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Thank you for calling Los Dos Gallos! This is Maria. How can I help you today?');

    // Listen for customer response
    twiml.gather({
      input: 'speech',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      language: 'en-US',
      action: '/process-speech',
      method: 'POST'
    });

    // Fallback if no speech detected
    twiml.say('I\'m sorry, I didn\'t hear anything. Please tell me what you\'d like to order.');

    res.type('text/xml');
    res.send(twiml.toString());
  }

  async processSpeech(req, res) {
    const speechResult = req.body.SpeechResult;
    const callSid = req.body.CallSid;
    const currentOrder = this.currentOrders.get(callSid) || { items: [], customerInfo: {}, total: 0, status: 'taking_order' };

    console.log(`Customer said: ${speechResult}`);

    try {
      // Process speech with OpenAI
      const aiResponse = await this.processWithAI(speechResult, currentOrder);
      
      // Update order based on AI response
      if (aiResponse.action === 'add_item') {
        currentOrder.items.push(aiResponse.item);
        currentOrder.total = this.calculateTotal(currentOrder.items);
      } else if (aiResponse.action === 'complete_order') {
        currentOrder.status = 'confirming';
      } else if (aiResponse.action === 'get_customer_info') {
        currentOrder.customerInfo = { ...currentOrder.customerInfo, ...aiResponse.customerInfo };
      }

      this.currentOrders.set(callSid, currentOrder);

      // Generate response
      const twiml = new twilio.twiml.VoiceResponse();
      
      twiml.say({
        voice: 'alice',
        language: 'en-US'
      }, aiResponse.response);

      // Continue conversation or complete order
      if (aiResponse.action === 'complete_order') {
        this.completeOrder(twiml, currentOrder);
      } else {
        twiml.gather({
          input: 'speech',
          speechTimeout: 'auto',
          speechModel: 'phone_call',
          language: 'en-US',
          action: '/process-speech',
          method: 'POST'
        });
      }

      res.type('text/xml');
      res.send(twiml.toString());

    } catch (error) {
      console.error('Error processing speech:', error);
      
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('I\'m sorry, I\'m having trouble understanding. Let me transfer you to one of our staff members.');
      twiml.dial(this.restaurantInfo.phone);
      
      res.type('text/xml');
      res.send(twiml.toString());
    }
  }

  async processWithAI(speechText, currentOrder) {
    const menuText = this.formatMenuForAI();
    const orderSummary = this.formatOrderSummary(currentOrder);

    const systemPrompt = `You are Maria, a friendly phone agent for Los Dos Gallos Mexican Restaurant in Moultrie, Georgia.

RESTAURANT INFO:
- Name: Los Dos Gallos
- Address: 2205 1st Ave SE, Moultrie, GA 31788
- Phone: (229) 890-9426
- Service: PICKUP ONLY (no delivery)
- Pickup time: Usually 20-25 minutes
- Tax rate: 7%

CURRENT MENU:
${menuText}

CURRENT ORDER:
${orderSummary}

INSTRUCTIONS:
- Be warm, friendly, and professional
- Help customers choose items from the menu
- Ask about modifications (add/remove ingredients)
- Suggest popular items if they're unsure
- Calculate totals including 7% tax
- Get customer name and phone number
- Provide pickup time estimate
- If they want something not on menu, politely explain we don't have it
- For complaints or complex issues, offer to transfer to manager

RESPONSE FORMAT:
Always respond in JSON format:
{
  "response": "What you say to the customer",
  "action": "add_item|complete_order|get_customer_info|continue_conversation|transfer_human",
  "item": { "name": "item name", "price": 0.00, "modifications": [] },
  "customerInfo": { "name": "customer name", "phone": "phone number" }
}`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: speechText }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    try {
      return JSON.parse(completion.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', completion.choices[0].message.content);
      return {
        response: "I'm sorry, could you please repeat that?",
        action: "continue_conversation"
      };
    }
  }

  formatMenuForAI() {
    let menuText = '';
    
    Object.keys(this.menu).forEach(category => {
      menuText += `\n${category.toUpperCase()}:\n`;
      this.menu[category].forEach(item => {
        menuText += `- ${item.name}: $${item.price} - ${item.description}\n`;
      });
    });
    
    return menuText;
  }

  formatOrderSummary(order) {
    if (order.items.length === 0) {
      return 'No items ordered yet.';
    }

    let summary = 'Items ordered:\n';
    order.items.forEach((item, index) => {
      summary += `${index + 1}. ${item.name} - $${item.price}\n`;
      if (item.modifications && item.modifications.length > 0) {
        summary += `   Modifications: ${item.modifications.join(', ')}\n`;
      }
    });

    const subtotal = order.items.reduce((sum, item) => sum + item.price, 0);
    const tax = subtotal * this.restaurantInfo.taxRate;
    const total = subtotal + tax;

    summary += `\nSubtotal: $${subtotal.toFixed(2)}`;
    summary += `\nTax (7%): $${tax.toFixed(2)}`;
    summary += `\nTotal: $${total.toFixed(2)}`;

    if (order.customerInfo.name) {
      summary += `\nCustomer: ${order.customerInfo.name}`;
    }
    if (order.customerInfo.phone) {
      summary += `\nPhone: ${order.customerInfo.phone}`;
    }

    return summary;
  }

  calculateTotal(items) {
    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const tax = subtotal * this.restaurantInfo.taxRate;
    return subtotal + tax;
  }

  completeOrder(twiml, order) {
    const total = this.calculateTotal(order.items);
    
    // Send order to POS system (you'll implement this)
    this.sendOrderToPOS(order);

    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, `Perfect! Your order total is $${total.toFixed(2)}. Your order will be ready for pickup in about ${this.restaurantInfo.averagePickupTime}. Thank you for choosing Los Dos Gallos!`);

    twiml.hangup();
  }

  async sendOrderToPOS(order) {
    // This is where you'll integrate with your POS system
    console.log('Sending order to POS:', {
      customer: order.customerInfo,
      items: order.items,
      total: this.calculateTotal(order.items),
      timestamp: new Date(),
      source: 'AI_Phone_Agent'
    });

    // TODO: Implement actual POS integration
    // Example:
    // await fetch('YOUR_POS_API_ENDPOINT/orders', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(order)
    // });
  }

  getOrderStatus(req, res) {
    const { callSid } = req.params;
    const order = this.currentOrders.get(callSid);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({
      callSid,
      order,
      total: this.calculateTotal(order.items)
    });
  }

  start(port = process.env.PORT || 3000) {
    this.app.listen(port, () => {
      console.log(`🐓 Los Dos Gallos Voice Agent running on port ${port}`);
      console.log(`📞 Phone webhook URL: http://your-domain.com/voice`);
      console.log(`🎯 Ready to take orders for ${this.restaurantInfo.name}!`);
    });
  }
}

// Environment variables setup guide
console.log(`
🚀 LOS DOS GALLOS AI VOICE AGENT SETUP

Required Environment Variables:
- OPENAI_API_KEY=your_openai_api_key
- TWILIO_ACCOUNT_SID=your_twilio_sid
- TWILIO_AUTH_TOKEN=your_twilio_token

Quick Start:
1. npm install express twilio openai
2. Set environment variables
3. Deploy to Heroku/Railway/Vercel
4. Configure Twilio webhook to point to your deployed URL/voice
5. Forward restaurant phone number to Twilio

🎯 This system will handle:
- Complete phone conversations
- Menu ordering with modifications
- Tax calculations
- Order confirmation
- POS system integration (needs your API)
`);

// Export for use
module.exports = LosDosGallosVoiceAgent;

// Run if this file is executed directly
if (require.main === module) {
  const agent = new LosDosGallosVoiceAgent();
  agent.start();
}