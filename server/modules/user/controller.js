/*
 * FILE: server/modules/user/controller.js
 *
 * RESPONSIBILITY:
 *   HTTP layer for user profile endpoints.
 *   Extracts data from requests, calls the user service,
 *   and sends appropriate HTTP responses.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Business logic (that is service.js)
 *   - Database queries (that is service.js via model.js)
 *   - Input validation (that is validators.js)
 *
 * HOW IT FITS:
 *   routes.js calls these functions after authenticate and validators pass.
 *   req.user.sub is the userId decoded from the JWT by authenticate middleware.
 */

const userService = require('./service');

/*
 * GET PROFILE
 *
 * GET /api/user/profile
 *
 * req.user.sub — userId from the decoded JWT access token.
 * No req.body needed — the token identifies who is asking.
 */
async function getProfile(req, res, next) {
  try {
    const profile = await userService.getProfile(req.user.sub);

    res.status(200).json({
      success: true,
      data: { user: profile },
    });
  } catch (err) {
    next(err);
  }
}

/*
 * UPDATE PROFILE
 *
 * PUT /api/user/profile
 *
 * Builds an update object from only the fields present in req.body.
 * Fields not sent are not included — this enables partial updates.
 *
 * Why build the object here and not in the service:
 *   The controller owns what comes from the HTTP request.
 *   It is the controller's job to extract and shape request data
 *   before handing it to the service as plain values.
 */
async function updateProfile(req, res, next) {
  try {
    const { firstName, lastName, displayName, country, phone, bio } = req.body;

    /*
     * Build an update object containing only fields that were sent.
     * If firstName was not in the body, it is undefined here,
     * and undefined fields are not included in the spread.
     *
     * Without this, sending { bio: 'hello' } would also attempt to
     * set firstName to undefined, which could overwrite existing data.
     */
    const fields = {};
    if (firstName   !== undefined) fields.firstName   = firstName;
    if (lastName    !== undefined) fields.lastName    = lastName;
    if (displayName !== undefined) fields.displayName = displayName;
    if (country     !== undefined) fields.country     = country;
    if (phone       !== undefined) fields.phone       = phone;
    if (bio         !== undefined) fields.bio         = bio;

    const user = await userService.updateProfile(req.user.sub, fields);

    res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

/*
 * CHANGE PASSWORD
 *
 * PUT /api/user/password
 *
 * Extracts currentPassword, newPassword from req.body.
 * confirmPassword was already validated in validators.js —
 * it does not need to be passed to the service.
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await userService.changePassword(
      req.user.sub,
      currentPassword,
      newPassword
    );

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile, changePassword };