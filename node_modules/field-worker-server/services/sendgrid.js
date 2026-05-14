const sgMail = require('@sendgrid/mail');


const sendEmail = async ({ to, subject, html }) => {
  try {
    const msg = {
      to,
      from: process.env.FROM_EMAIL, // MUST be verified in SendGrid
      subject,
      html,
    };

    const response = await sgMail.send(msg);

    console.log('✅ Email sent:', response[0].statusCode);

    return response;
  } catch (error) {
    console.error('❌ SendGrid error:', error.response?.body || error.message);
    throw error;
  }
};

module.exports = { sendEmail };