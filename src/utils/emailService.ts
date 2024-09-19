import axios from 'axios';
import { GMAIL_USER } from '../config';
import { logger } from './logger';

async function sendEmail(email: string, subject: string, content: string) {
  try {
    // Configure the email details
    const mailOptions = {
      from: GMAIL_USER, // Sender's email address
      to: email, // Recipient's email address
      subject: subject, // Email subject
      text: content, // Always send as HTML
    };

    console.log('Email content:', content);

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://eoze3kvt7ugp3rh.m.pipedream.net',
      headers: {
        'Content-Type': 'application/json',
      },
      data: mailOptions,
    };

    const info = await axios.request(config);
    console.log(`Email sent :: ${email}`);
    logger.info(`Email sent :: ${email}`);
  } catch (error) {
    logger.error(`Error Sending Email Due to Error :: ${error} `);
    console.error('Error sending email:', error);
  }
}

export default sendEmail;
