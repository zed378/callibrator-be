exports.validation = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,

      stripUnknown: true,
    });

    if (error) {
      return res.status(400).send({
        success: false,

        message: "Validation failed",

        errors: error.details.map((item) => ({
          field: item.path.join("."),
          message: item.message,
        })),
      });
    }

    next();
  };
};
