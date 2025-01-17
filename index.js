const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
 
//mideware
app.use(cors());
app.use(express.json());


 

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uxfsb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const userCollection = client.db("EduManageDb").collection("users");
    const teacherRequestCollection = client.db("EduManageDb").collection("teacherRequests");
    const teacherCollection = client.db("EduManageDb").collection("teacher");
    const classCollection = client.db("EduManageDb").collection("classes");
    

    // jwt releated api
    app.post('/jwt',async(req,res)=>{
        const user = req.body;
        const token = jwt.sign(user,process.env.ACCESS_SECRET_TOKEN,{expiresIn:'1h'});
        res.send({token});
      })

      const verifyToken = (req,res,next)=>{
          // console.log('inside verify token', req.headers.authorization);
        if(!req.headers.authorization)
          {
            return res.status(403).send({ message: 'forbidden access' });
          }
          const token = req.headers.authorization.split(' ')[1];
          // console.log(token)
        
         jwt.verify(token,process.env.ACCESS_SECRET_TOKEN,(error,decoded)=>{
          if(error){
            return res.status(401).send({message : 'forbidden access'})
          }
        
          req.decoded = decoded
          next();
         })
      }

    app.post('/users', async (req,res)=>{
        const user = req.body;
        const query = {email:user.email}
        const existingUser = await userCollection.findOne(query);
        if(existingUser){
          return res.send({message: 'user allready exist',insertedId:null})
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      })

 
      app.get('/users', verifyToken, async (req, res) => {
        const search = req.query.search || ''; // Retrieve the search query parameter
        try {
          // Search query: Find users by name or email (case-insensitive)
          const query = {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
            ],
          };
      
          const result = await userCollection.find(query).toArray();
          res.status(200).send(result); // Send matching users
        } catch (error) {
          console.error('Error fetching users:', error);
          res.status(500).send({ error: 'Internal Server Error' });
        }
      });

      app.patch('/users/role/:id',verifyToken, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: 'admin'
          }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      })









      app.get('/users/role/:email',verifyToken,async(req,res)=>{
        const email = req.params.email;
        // console.log(email)
        if(email!== req.decoded.email )
        {
          return res.status(403).send({message:'unauthorized access'})
        }
        const query = {email:email};
        const user = await userCollection.findOne(query);
        let role = '';
        if(user){
          role = user?.role ;
        }
        res.send({ role });
  
      })






      
      app.post('/teacher-requests', verifyToken, async (req, res) => {
        const { email } = req.decoded; // Get email from decoded token
        const requestData = req.body; // Form data from frontend
        requestData.email = email;
        requestData.status = 'pending'; // Initial status
        requestData.createdAt = new Date(); // Timestamp
  
        const result = await teacherRequestCollection.insertOne(requestData);
        res.send(result);
      });


      app.get('/teacher-requests/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        // console.log(email);
    
        if (email !== req.decoded.email) {
            return res.status(403).send({ message: 'unauthorized access' });
        }
    
        try {
            const query = { email: email };
            const teacherRequests = await teacherRequestCollection.find(query).toArray();
            res.status(200).send(teacherRequests);
        } catch (error) {
            console.error('Error fetching teacher requests:', error);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    });

    app.get('/teacher',verifyToken,async(req,res)=>{
      const teacherRequests = await teacherRequestCollection.find().toArray();
      res.send(teacherRequests)

 
    })
    

    //////////////////


    app.patch('/teacher/update-status/:email',verifyToken, async(req,res)=>{
      const email = req.params.email;
      const { status } = req.body;
      const filter = { email: email };
      const updatedDoc = {
        $set: { status: status }
      };
      const result = await  teacherRequestCollection.updateOne(filter, updatedDoc);
      res.send(result);
 
    })   


app.patch('/updateRole/:email',async(req,res)=>{
  const {email}=req.params;
  const {role}= req.body;
  try {
    const result = await userCollection.updateOne(
      { email },
      { $set: { role } }
    );
    if (result.modifiedCount > 0) {
      res.status(200).json({ message: 'User role updated successfully!' });
    } else {
      res.status(404).json({ error: 'User not found or role unchanged!' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error updating user role!' });
  }
})



   
app.post('/addClass',async(req,res)=>{
  const classData = req.body;
  const result = await classCollection.insertOne(classData);
  res.send(result);

})


app.get('/myclasses/:email',async(req,res)=>{
  const {email}= req.params;
  const classes = await classCollection.find({email}).toArray();
  res.send(classes);
})

app.get('/classes',verifyToken,async(req,res)=>{

const result = await classCollection.find().toArray();
res.send(result); 
})





app.patch('/class/update-status/:classId',verifyToken, async(req,res)=>{
  const id = req.params.classId;
  const { status } = req.body;
  console.log(status,id)
  const filter = { _id: new ObjectId(id) };
  const updatedDoc = {
    $set: { status: status }
  };
  const result = await  classCollection.updateOne(filter, updatedDoc);
  res.send(result);

})  

app.patch('/classes/:id',async(req,res)=>{
  const id = req.params.id;
  const updatedClass = req.body;
  console.log(updatedClass);
  const filter = {_id:new ObjectId(id)}
  const updatedDoc={
    $set:{
      title:updatedClass.title,
      price:updatedClass.price,
      Description:updatedClass.Description,
      image:updatedClass.image


    }
  };
  const result = await  classCollection.updateOne(filter, updatedDoc);
  res.send(result);


})


app.delete('/classes/:id',async(req,res)=>{

  const id = req.params.id;
  const query = { _id: new ObjectId(id) }
  const result = await classCollection.deleteOne(query);
  res.send(result);
})

 





///////////////////




    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

     


 


app.get('/',(req,res)=>{
    res.send('boss is sitting')
} )

app.listen(port,()=>{
    console.log(`bistro boss is sitting on port ${port}`);
})