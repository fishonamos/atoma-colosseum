require('dotenv').config();
import { AtomaSDK } from 'atoma-sdk';

console.log('process.env',process.env.ATOMASDK_BEARER_AUTH);
const atomaSDK = new AtomaSDK({
  bearerAuth: process.env.ATOMASDK_BEARER_AUTH,
});

export default atomaSDK;