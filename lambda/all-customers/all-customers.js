const AWS = require("aws-sdk");

exports.handler = (event, context) => {
    event.Records.forEach(record => {
        const message = JSON.parse(record.body);
        if (message.MessageAttributes) {
            const customerType = message.MessageAttributes.type.Value;
            console.log("Customer Type: " + customerType);
        } else {
            console.log("Customer Type: All Customers");
        }
    });
};

