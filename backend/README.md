# 🏊‍♂️ UofT Triathlon Club - Backend API

A complete Node.js + Express + SQLite backend for the UofT Triathlon Club website.

## 🚀 Features

- **User Authentication** - JWT-based login/signup system
- **Role-Based Access Control** - Public, Pending, Member, Exec, Administrator roles
- **Member Management** - Approve/reject members, manage roles
- **Forum System** - Create, read, update, delete posts
- **Workout Signups** - Track member workout attendance
- **Admin Dashboard** - Statistics, member management, login tracking
- **SQLite Database** - Lightweight, file-based database (no setup required)

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## 🛠️ Installation

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Initialize database:**
   ```bash
   npm run init-db
   ```

4. **Start the server:**
   ```bash
   # Development mode (with auto-restart)
   npm run dev
   
   # Production mode
   npm start
   ```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/change-password` - Change password

### Members
- `GET /api/members` - Get all members (requires member role)
- `GET /api/members/:id` - Get member by ID
- `PUT /api/members/:id` - Update member profile
- `GET /api/members/:id/workouts` - Get member's workout signups
- `POST /api/members/:id/workouts` - Sign up for workout
- `DELETE /api/members/:id/workouts/:workoutId` - Cancel workout signup

### Forum
- `GET /api/forum` - Get all forum posts
- `GET /api/forum/:id` - Get single post
- `POST /api/forum` - Create new post
- `PUT /api/forum/:id` - Update post
- `DELETE /api/forum/:id` - Delete post
- `POST /api/forum/:id/like` - Like a post

### Admin (requires administrator role)
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/members` - Member management
- `PUT /api/admin/members/:id/approve` - Approve member
- `PUT /api/admin/members/:id/reject` - Reject member
- `PUT /api/admin/members/:id/role` - Update member role
- `GET /api/admin/login-history` - Login activity
- `GET /api/admin/workout-stats` - Workout statistics
- `GET /api/admin/export/members` - Export member list (CSV)

## 🔐 Default Admin Account

After running `npm run init-db`, you'll have a default admin account:

- **Email**: `info@uoft-tri.club`
- **Password**: `admin123`
- **Role**: Administrator

## 🗄️ Database Schema

### Users Table
- `id` - Primary key
- `email` - Unique email address
- `password` - Hashed password
- `name` - Full name
- `role` - User role (pending, member, exec, administrator)
- `created_at` - Account creation timestamp
- `last_login` - Last login timestamp
- `is_active` - Account status

### Members Table
- `id` - Primary key
- `user_id` - Foreign key to users table
- `membership_type` - Student, Alumni, Community, Faculty
- `join_date` - Membership start date
- `payment_confirmed` - Payment verification status
- `emergency_contact` - Emergency contact information
- `phone` - Phone number
- `address` - Address

### Forum Posts Table
- `id` - Primary key
- `user_id` - Foreign key to users table
- `content` - Post content
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `likes` - Like count
- `is_deleted` - Soft delete flag

### Login History Table
- `id` - Primary key
- `user_id` - Foreign key to users table
- `login_time` - Login timestamp
- `ip_address` - IP address
- `user_agent` - Browser/device information

### Workout Signups Table
- `id` - Primary key
- `user_id` - Foreign key to users table
- `workout_type` - Swim, Bike, Run, Brick
- `workout_date` - Workout date
- `workout_time` - Workout time
- `location` - Workout location
- `signed_up_at` - Signup timestamp
- `attended` - Attendance status

## 🔧 Environment Variables

Create a `.env` file in the backend directory:

```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-here
```

## 🚀 Development

### Running in Development Mode
```bash
npm run dev
```
This uses nodemon for auto-restart on file changes.

### Database Reset
To reset the database:
1. Delete `database.sqlite` file
2. Run `npm run init-db`

### Testing API Endpoints
Use tools like:
- **Postman** - API testing
- **Insomnia** - API client
- **curl** - Command line testing

## 📊 API Response Format

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

### Pagination Response
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt with salt rounds
- **Role-Based Access** - Granular permission control
- **Rate Limiting** - Prevent abuse
- **Input Validation** - Sanitize all inputs
- **SQL Injection Protection** - Parameterized queries

## 🚀 Production Deployment

### Heroku
1. Create Heroku app
2. Set environment variables
3. Deploy with `git push heroku main`

### DigitalOcean
1. Create droplet
2. Install Node.js and PM2
3. Use PM2 for process management

### AWS
1. Use EC2 or Lambda
2. Set up RDS for database (optional)
3. Configure load balancer

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   - Change PORT in .env file
   - Kill existing process: `lsof -ti:5000 | xargs kill`

2. **Database locked**
   - Ensure only one instance is running
   - Check file permissions

3. **JWT errors**
   - Verify JWT_SECRET is set
   - Check token expiration

### Logs
Check console output for detailed error messages and debugging information.

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📞 Support

For questions or issues, contact the development team or create an issue in the repository.


