const AWS = require("aws-sdk");

exports.handler =  (event, context) => {
    event.Records.forEach(record => {
        const message = JSON.parse(record.body);
        if(message.MessageAttributes) {
            const customerType = message.MessageAttributes.customer_type.Value;
            console.log("Customer Type: "+ customerType);
        }
    });
};
