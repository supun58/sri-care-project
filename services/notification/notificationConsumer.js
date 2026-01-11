const amqp = require('amqplib');

const queues = new Map();

async function startConsumer() {
  try {
    const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://sricare:sricare123@localhost:5672';
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    
    // Bind to payment and provisioning events
    await channel.assertExchange('payment.events', 'topic', { durable: true });
    await channel.assertExchange('provisioning.events', 'topic', { durable: true });
    
    const queue = await channel.assertQueue('notifications', { durable: true });
    await channel.bindQueue(queue.queue, 'payment.events', '#');
    await channel.bindQueue(queue.queue, 'provisioning.events', '#');
    
    console.log('✅ Notification consumer listening for events...');
    
    channel.consume(queue.queue, (msg) => {
      if (msg) {
        try {
          const event = JSON.parse(msg.content.toString());
          console.log('📬 Received event:', event.event);
          
          // Store event for user polling
          if (event.userId) {
            const userQueue = queues.get(String(event.userId)) || [];
            userQueue.push({
              id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
              event: event.event,
              payload: event.payload,
              createdAt: new Date().toISOString()
            });
            queues.set(String(event.userId), userQueue);
          }
          
          channel.ack(msg);
        } catch (error) {
          console.error('Event processing error:', error);
          channel.nack(msg);
        }
      }
    });
  } catch (error) {
    console.error('❌ RabbitMQ consumer error:', error.message);
    setTimeout(startConsumer, 5000);
  }
}

module.exports = { startConsumer, queues };
