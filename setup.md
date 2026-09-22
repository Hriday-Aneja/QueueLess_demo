
````md
# QueueLess — Local Setup

## 1. Install XAMPP

Download and install XAMPP:

https://www.apachefriends.org/

During installation, make sure **Apache** and **PHP** are installed.

After installation, open **XAMPP Control Panel** and start:

```text
Apache → Start
````

### MySQL

If you already have MySQL installed separately, **do not start XAMPP MySQL**.

QueueLess uses MySQL on:

```text
localhost:3306
```

---

## 2. Put the Project in htdocs

Clone/download the QueueLess repository.

The project must be inside:

```text
C:\xampp\htdocs\queueless
```

The structure should look like:

```text
C:\xampp\htdocs\queueless
│
├── backend
├── frontend
├── docs
├── README.md
└── ...
```

**Important:** `queueless` should be the actual Git repository folder.

You can check:

```powershell
cd C:\xampp\htdocs\queueless
git status
```

It should show:

```text
On branch main
```

---

## 3. Create the Database

Make sure MySQL is running.

Create a database named:

```text
queueless
```

Then import:

```text
backend/database/schema.sql
backend/database/seed.sql
```

The schema creates the tables and the seed file adds demo data.

---

## 4. Run the Project

Start **Apache** in XAMPP.

Open:

```text
http://localhost/queueless/
```

Admin Panel:

```text
http://localhost/queueless/frontend/admin/index.html
```

---

## 5. Git Workflow

Before working:

```bash
git pull origin main
```

After making changes:

```bash
git add <your-files>
git commit -m "your message"
git push origin main
```

Always work from:

```text
C:\xampp\htdocs\queueless
```

This is important because Apache directly serves the project from `htdocs`.

---

## Team Setup

```text
GitHub
   ↓
C:\xampp\htdocs\queueless
   ↓
Apache (XAMPP)
   ↓
http://localhost/queueless/
   ↓
PHP + MySQL
```

Each team member uses their **own local MySQL database/password**.

Do not share or commit local MySQL passwords.

```

**Bas ye wala README rakho.** Short, practical, aur specifically tumhare current setup ke according.
```
