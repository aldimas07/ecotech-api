const app = require('../index')
const supertest = require('supertest')
const request = supertest(app)

require("dotenv").config();

it("should return Response Success!", async done => {
    const res = await request.get('/')
    expect(res.status).toBe(200)
    expect(res.text).toBe('Response successs')
    done()
})
