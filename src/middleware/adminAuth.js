import config from '../config/index.js';
import logger from '../utils/logger.js';

const adminAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    logger.warn({
      message: 'Admin access attempted without API key',
      ip: req.ip,
      url: req.url,
    });
    
    return res.status(401).json({
      error: {
        message: 'API key required',
        status: 401,
      },
    });
  }
  
  if (apiKey !== config.adminApiKey) {
    logger.warn({
      message: 'Admin access attempted with invalid API key',
      ip: req.ip,
      url: req.url,
      providedKey: apiKey.substring(0, 8) + '...',
    });
    
    return res.status(401).json({
      error: {
        message: 'Invalid API key',
        status: 401,
      },
    });
  }
  
  logger.info({
    message: 'Admin access granted',
    ip: req.ip,
    url: req.url,
  });
  
  // Store admin context
  req.isAdmin = true;
  next();
};

export default adminAuth;