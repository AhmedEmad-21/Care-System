const Ajv = require('ajv').default;
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, removeAdditional: true, useDefaults: true });
addFormats(ajv);

module.exports = (schema) => {
  if (!schema) throw new Error('validateAjvMW requires a JSON schema');
  const validate = ajv.compile(schema);

  return (req, res, next) => {
    const data = req.body || {};
    const valid = validate(data);
    if (!valid) {
      const errors = (validate.errors || []).map((e) => ({ path: e.instancePath || e.dataPath, message: e.message }));
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }
    next();
  };
};
