/**
 * Tests for notFound middleware
 */
jest.mock("../../utils/response", () => ({
  notFound: jest.fn(),
}));

const { notFound } = require("../../middlewares/notFound");
const { notFound: sendNotFound } = require("../../utils/response");

describe("notFound middleware", () => {
  it("should call sendNotFound with res and message", () => {
    const req = { originalUrl: "/api/nonexistent" };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    notFound(req, res);

    expect(sendNotFound).toHaveBeenCalledWith(res, "Route not found");
  });
});
