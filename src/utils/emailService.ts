// import nodemailer from 'nodemailer';
import axios from 'axios';
import { GMAIL_PASSWORD, GMAIL_USER } from '../config';
import { logger } from './logger';

async function sendEmail(email: string, subject: string, text: string) {
  try {
    // Create a transporter object using the default SMTP transport
    // const transporter = nodemailer.createTransport({
    //   service: 'Gmail', // Use your email service provider here if not using Gmail
    //   auth: {
    //     user: GMAIL_USER, // Your email address
    //     pass: GMAIL_PASSWORD, // Your email password or app password
    //   },
    // });

    // Configure the email details
    const mailOptions = {
      from: GMAIL_USER, // Sender's email address
      to: email, // Recipient's email address
      subject: subject, // Email subject
      text: text, // Email text
    };

    // Send the email
    // const info = await transporter.sendMail(mailOptions);

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
    logger.info(`Email send :: ${email}`);
  } catch (error) {
    logger.error(`Error Sending Email Due to Error :: ${error} `);
    console.error('Error sending email:', error);
  }
}

export default sendEmail;
