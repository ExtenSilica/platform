/**
 * OpenAPI path definitions for implementation coordination (Phase C).
 * Scanned by swagger-jsdoc — see `src/swagger.ts`.
 */

/**
 * @swagger
 * tags:
 *   - name: Implementation coordination
 *     description: >
 *       Request → implement → verify workflow for `.xsil` packages.
 *       No on-platform payments; funding fields are contact-only.
 *   - name: Implementation — Me
 *     description: Authenticated user's implementation activity
 *   - name: Implementation — Admin
 *     description: Platform operator endpoints (requires platform admin)
 */

/**
 * @swagger
 * /packages/{name}/implementation-requests:
 *   get:
 *     tags: [Implementation coordination]
 *     summary: List implementation requests for a package
 *     description: >
 *       Returns requests visible to the caller (public/open items for anonymous users;
 *       org-only and unlisted items when permitted). For scoped packages use
 *       `name=@scope/pkg` (URL-encoded as `%40scope%2Fpkg`).
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *         description: Package slug or scoped name (`@scope/name`)
 *     responses:
 *       200:
 *         description: Visible requests for this package
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requests:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ImplementationRequest' }
 *       404:
 *         description: Package not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   post:
 *     tags: [Implementation coordination]
 *     summary: Create an implementation request on a package
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateImplementationRequestBody' }
 *     responses:
 *       201:
 *         description: Request created (status `draft`)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 request: { $ref: '#/components/schemas/ImplementationRequest' }
 *       400:
 *         description: Validation error or forbidden payment fields
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not allowed to file for the given organization
 *       404:
 *         description: Package not found
 */

/**
 * @swagger
 * /implementation-requests:
 *   get:
 *     tags: [Implementation coordination]
 *     summary: List implementation requests (catalog)
 *     description: >
 *       Returns up to 100 requests the caller may view. Optional filters:
 *       `status` (exact) and `capability` (case-insensitive substring on `targetCapability`).
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, open, in_progress, submitted, verified, completed, cancelled]
 *       - in: query
 *         name: capability
 *         schema: { type: string }
 *         description: Substring match on targetCapability
 *     responses:
 *       200:
 *         description: Visible requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requests:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ImplementationRequest' }
 */

/**
 * @swagger
 * /implementation-requests/{id}:
 *   get:
 *     tags: [Implementation coordination]
 *     summary: Get one implementation request
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 request: { $ref: '#/components/schemas/ImplementationRequest' }
 *       404:
 *         description: Not found or not visible
 *   patch:
 *     tags: [Implementation coordination]
 *     summary: Update request fields or transition status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PatchImplementationRequestBody' }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 request: { $ref: '#/components/schemas/ImplementationRequest' }
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not allowed to edit or transition
 *       404:
 *         description: Not found or not visible
 */

/**
 * @swagger
 * /implementation-requests/{id}/interests:
 *   post:
 *     tags: [Implementation coordination]
 *     summary: Express interest in implementing a request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Interest recorded
 *       401:
 *         description: Authentication required
 *       409:
 *         description: Duplicate interest or request is draft/cancelled
 */

/**
 * @swagger
 * /implementation-requests/{id}/milestones:
 *   post:
 *     tags: [Implementation coordination]
 *     summary: Add a milestone to a request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ImplementationMilestoneInput' }
 *     responses:
 *       201:
 *         description: Milestone created
 *       403:
 *         description: Not allowed to edit this request
 */

/**
 * @swagger
 * /implementation-requests/{id}/milestones/{mid}:
 *   patch:
 *     tags: [Implementation coordination]
 *     summary: Update a milestone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: mid
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ImplementationMilestoneInput' }
 *     responses:
 *       200:
 *         description: Milestone updated
 *       404:
 *         description: Request or milestone not found
 */

/**
 * @swagger
 * /implementation-requests/{id}/submissions:
 *   post:
 *     tags: [Implementation coordination]
 *     summary: Create a deliverable submission (draft)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateImplementationSubmissionBody' }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 submission: { $ref: '#/components/schemas/ImplementationSubmission' }
 *       409:
 *         description: Request not open or in_progress
 */

/**
 * @swagger
 * /submissions/{id}:
 *   patch:
 *     tags: [Implementation coordination]
 *     summary: Update or submit a deliverable
 *     description: >
 *       Set `status` to `submitted` to finalize (author only). When the parent request
 *       is `in_progress`, submitting moves it to `submitted`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PatchImplementationSubmissionBody' }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 submission: { $ref: '#/components/schemas/ImplementationSubmission' }
 *       403:
 *         description: Not allowed to edit
 *       404:
 *         description: Submission not found
 */

/**
 * @swagger
 * /submissions/{id}/verification-runs:
 *   post:
 *     tags: [Implementation coordination]
 *     summary: Record a verification outcome for a submitted deliverable
 *     description: >
 *       `pass` moves the parent request to `verified`. Does not change package
 *       `portStatus` (that is a separate maintainer action).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateVerificationRunBody' }
 *     responses:
 *       201:
 *         description: Verification run recorded
 *       403:
 *         description: Not allowed to verify
 *       409:
 *         description: Submission or request not in submitted state
 */

/**
 * @swagger
 * /me/implementation-requests:
 *   get:
 *     tags: [Implementation — Me]
 *     summary: List requests created by, assigned to, or interested by the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requests:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ImplementationRequest' }
 *       401:
 *         description: Authentication required
 */

/**
 * @swagger
 * /me/implementation-submissions:
 *   get:
 *     tags: [Implementation — Me]
 *     summary: List deliverable submissions authored by the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 submissions:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ImplementationSubmission' }
 *       401:
 *         description: Authentication required
 */

/**
 * @swagger
 * /users/{username}/contributions:
 *   get:
 *     tags: [Implementation coordination]
 *     summary: Public coordination history for a user profile
 *     description: >
 *       Non-draft public requests only. Never exposes private email or payment data.
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UserContributions' }
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /admin/implementation-requests:
 *   get:
 *     tags: [Implementation — Admin]
 *     summary: List all implementation requests (platform admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, open, in_progress, submitted, verified, completed, cancelled]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requests:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ImplementationRequest' }
 *       403:
 *         description: Platform admin required
 */

/**
 * @swagger
 * /admin/implementation-requests/{id}/cancel:
 *   post:
 *     tags: [Implementation — Admin]
 *     summary: Cancel an implementation request (platform admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 request: { $ref: '#/components/schemas/ImplementationRequest' }
 *       409:
 *         description: Already cancelled or completed
 */

export {};
