# Use the official RabbitMQ image with the management plugin
FROM rabbitmq:3-management

# Expose RabbitMQ ports
EXPOSE 5672 15672

# Default credentials
ENV RABBITMQ_DEFAULT_USER=guest
ENV RABBITMQ_DEFAULT_PASS=guest

CMD ["rabbitmq-server"]
