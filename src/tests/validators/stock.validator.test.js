/**
 * Stock validator tests
 */
const {
  validate,
  formatErrors,
  getStocksQuery,
  stockIdSchema,
  createStockSchema,
  updateStockSchema,
  createTransferSchema,
  updateTransferStatusSchema,
  createAdjustmentSchema,
  createOpnameSchema,
  updateOpnameStatusSchema,
} = require("../../validators/stock.validator");

describe("Stock Validators", () => {
  describe("getStocksQuery", () => {
    it("should validate correct query parameters and apply defaults", () => {
      const data = {
        page: "3",
        limit: "50",
        find: "needle",
        warehouseId: "8c352a92-d6cf-4b71-b0db-6e69622d1b11",
        locationId: "8c352a92-d6cf-4b71-b0db-6e69622d1b12",
      };

      const { error, value } = validate(data, getStocksQuery);

      expect(error).toBeUndefined();
      expect(value).toEqual({
        page: 3,
        limit: 50,
        find: "needle",
        warehouseId: "8c352a92-d6cf-4b71-b0db-6e69622d1b11",
        locationId: "8c352a92-d6cf-4b71-b0db-6e69622d1b12",
      });
    });

    it("should allow missing or null optional fields", () => {
      const data = {};
      const { error, value } = validate(data, getStocksQuery);

      expect(error).toBeUndefined();
      expect(value.page).toBe(1);
      expect(value.limit).toBe(20);
    });

    it("should reject invalid warehouseId or locationId UUIDs", () => {
      const data = {
        warehouseId: "invalid-uuid",
      };
      const { error } = validate(data, getStocksQuery);
      expect(error).toBeDefined();
    });
  });

  describe("stockIdSchema", () => {
    it("should validate correct uuid", () => {
      const data = {
        stockId: "8c352a92-d6cf-4b71-b0db-6e69622d1b11",
      };
      const { error } = validate(data, stockIdSchema);
      expect(error).toBeUndefined();
    });

    it("should reject invalid or missing uuid", () => {
      const data = {
        stockId: "invalid",
      };
      const { error } = validate(data, stockIdSchema);
      expect(error).toBeDefined();
    });
  });

  describe("createStockSchema", () => {
    it("should validate correct stock creation data", () => {
      const data = {
        warehouseId: "8c352a92-d6cf-4b71-b0db-6e69622d1b11",
        locationId: "8c352a92-d6cf-4b71-b0db-6e69622d1b12",
        itemName: "Calibration Weight 1kg",
        sku: "SKU-CW1KG",
        serialNumber: "SN-991823",
        quantity: 10,
        minQuantity: 2,
        description: "Standard weight",
      };

      const { error, value } = validate(data, createStockSchema);
      expect(error).toBeUndefined();
      expect(value.itemName).toBe("Calibration Weight 1kg");
      expect(value.quantity).toBe(10);
    });

    it("should reject missing required fields (warehouseId, itemName)", () => {
      const data = {
        itemName: "Calibration Weight 1kg",
      };
      const { error } = validate(data, createStockSchema);
      expect(error).toBeDefined();
    });

    it("should reject negative quantity or minQuantity", () => {
      const data = {
        warehouseId: "8c352a92-d6cf-4b71-b0db-6e69622d1b11",
        itemName: "Calibration Weight 1kg",
        quantity: -1,
      };
      const { error } = validate(data, createStockSchema);
      expect(error).toBeDefined();
    });
  });

  describe("updateStockSchema", () => {
    it("should validate correct partial update data", () => {
      const data = {
        itemName: "Updated Calibration Weight 1kg",
        quantity: 15,
        minQuantity: 4,
      };

      const { error, value } = validate(data, updateStockSchema);
      expect(error).toBeUndefined();
      expect(value.quantity).toBe(15);
    });

    it("should reject negative values for quantity or minQuantity", () => {
      const data = {
        quantity: -5,
      };
      const { error } = validate(data, updateStockSchema);
      expect(error).toBeDefined();
    });
  });

  describe("createTransferSchema", () => {
    it("should validate correct transfer data", () => {
      const data = {
        fromWarehouseId: "8c352a92-d6cf-4b71-b0db-6e69622d1b11",
        toWarehouseId: "8c352a92-d6cf-4b71-b0db-6e69622d1b12",
        itemName: "Calibration Weight 1kg",
        quantity: 5,
        notes: "Moving for calibration",
      };

      const { error, value } = validate(data, createTransferSchema);
      expect(error).toBeUndefined();
      expect(value.quantity).toBe(5);
    });

    it("should reject quantity less than 1", () => {
      const data = {
        fromWarehouseId: "8c352a92-d6cf-4b71-b0db-6e69622d1b11",
        toWarehouseId: "8c352a92-d6cf-4b71-b0db-6e69622d1b12",
        itemName: "Calibration Weight 1kg",
        quantity: 0,
      };
      const { error } = validate(data, createTransferSchema);
      expect(error).toBeDefined();
    });
  });

  describe("updateTransferStatusSchema", () => {
    it("should validate correct status value", () => {
      const data = {
        status: "completed",
      };
      const { error, value } = validate(data, updateTransferStatusSchema);
      expect(error).toBeUndefined();
      expect(value.status).toBe("completed");
    });

    it("should reject invalid status value", () => {
      const data = {
        status: "unknown_status",
      };
      const { error } = validate(data, updateTransferStatusSchema);
      expect(error).toBeDefined();
    });
  });

  describe("createAdjustmentSchema", () => {
    it("should validate correct adjustment data", () => {
      const data = {
        stockId: "8c352a92-d6cf-4b71-b0db-6e69622d1b11",
        type: "addition",
        quantity: 12,
        reason: "Found in warehouse during clean up",
      };

      const { error, value } = validate(data, createAdjustmentSchema);
      expect(error).toBeUndefined();
      expect(value.type).toBe("addition");
    });

    it("should reject invalid type", () => {
      const data = {
        stockId: "8c352a92-d6cf-4b71-b0db-6e69622d1b11",
        type: "multiplication",
        quantity: 12,
      };
      const { error } = validate(data, createAdjustmentSchema);
      expect(error).toBeDefined();
    });
  });

  describe("createOpnameSchema", () => {
    it("should validate correct scheduledAt date", () => {
      const data = {
        warehouseId: "8c352a92-d6cf-4b71-b0db-6e69622d1b11",
        scheduledAt: "2026-06-25T10:00:00Z",
        notes: "Monthly physical inventory count",
      };

      const { error, value } = validate(data, createOpnameSchema);
      expect(error).toBeUndefined();
      expect(value.scheduledAt).toBeInstanceOf(Date);
    });

    it("should reject invalid date formats", () => {
      const data = {
        warehouseId: "8c352a92-d6cf-4b71-b0db-6e69622d1b11",
        scheduledAt: "not-a-date",
      };
      const { error } = validate(data, createOpnameSchema);
      expect(error).toBeDefined();
    });
  });

  describe("updateOpnameStatusSchema", () => {
    it("should validate correct status", () => {
      const data = {
        status: "in_progress",
      };
      const { error, value } = validate(data, updateOpnameStatusSchema);
      expect(error).toBeUndefined();
      expect(value.status).toBe("in_progress");
    });

    it("should reject invalid status", () => {
      const data = {
        status: "cancelled", // cancelled is not valid for opname in schema
      };
      const { error } = validate(data, updateOpnameStatusSchema);
      expect(error).toBeDefined();
    });
  });

  describe("formatErrors", () => {
    it("should format errors correctly", () => {
      const details = [
        { path: ["stockId"], message: "Stock ID is required" },
      ];
      const formatted = formatErrors(details);
      expect(formatted).toEqual([
        { field: "stockId", message: "Stock ID is required" },
      ]);
    });
  });
});
