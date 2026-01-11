const amqp = require('amqplib');

let channel = null;
let connection = null;

async function connect() {
  try {
    const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://sricare:sricare123@localhost:5672';
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    
    // Declare exchanges
    await channel.assertExchange('provisioning.events', 'topic', { durable: true });
    
    console.log('✅ RabbitMQ connected (Provisioning Service)');
  } catch (error) {
    console.error('❌ RabbitMQ connection failed:', error.message);
    setTimeout(connect, 5000); // Retry after 5s
  }
}

async function publishToQueue(exchange, message) {
  if (!channel) {
    console.warn('RabbitMQ not connected, skipping publish');
    return;
  }
  
  try {
    channel.publish(
      exchange,
      '', // routing key (empty for fanout behavior on topic)
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
  } catch (error) {
    console.error('Publish error:', error);
  }
}

// Initialize connection
connect();

module.exports = { publishToQueue };
