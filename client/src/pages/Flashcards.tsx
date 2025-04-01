import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { Sidebar } from '@/components/ui/sidebar';
import { MobileNav } from '@/components/ui/mobile-nav';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, BookOpen, RotateCw, Share2, ArrowLeftRight, Play, BookCopy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, updateDoc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';

// Define Flashcard and Flashcard Collection types
type Flashcard = {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
  updatedAt: string;
};

type FlashcardCollection = {
  id: string;
  name: string;
  description: string;
  groupId: number;
  creatorId: string;
  creatorName: string;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
};

// Schemas for creating and editing flashcard collections
const createCollectionSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  groupId: z.string(),
});

const createFlashcardSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required'),
});

type CreateCollectionFormValues = z.infer<typeof createCollectionSchema>;
type CreateFlashcardFormValues = z.infer<typeof createFlashcardSchema>;

export default function Flashcards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const params = useParams();
  
  // State
  const [activeTab, setActiveTab] = useState<string>('collections');
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [collections, setCollections] = useState<FlashcardCollection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<FlashcardCollection | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoadingFlashcards, setIsLoadingFlashcards] = useState(false);
  const [createCollectionDialogOpen, setCreateCollectionDialogOpen] = useState(false);
  const [createFlashcardDialogOpen, setCreateFlashcardDialogOpen] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [editMode, setEditMode] = useState<{ active: boolean; flashcard: Flashcard | null }>({
    active: false,
    flashcard: null,
  });
  
  // Collection form
  const collectionForm = useForm<CreateCollectionFormValues>({
    resolver: zodResolver(createCollectionSchema),
    defaultValues: {
      name: '',
      description: '',
      groupId: '',
    },
  });
  
  // Flashcard form
  const flashcardForm = useForm<CreateFlashcardFormValues>({
    resolver: zodResolver(createFlashcardSchema),
    defaultValues: {
      question: '',
      answer: '',
    },
  });
  
  // Fetch user's groups
  useEffect(() => {
    if (!user) return;
    
    const fetchGroups = async () => {
      try {
        setIsLoadingGroups(true);
        const groupMembersRef = collection(db, 'group_members');
        const q = query(groupMembersRef, where('userId', '==', user.id));
        const querySnapshot = await getDocs(q);
        
        const userGroupIds = querySnapshot.docs.map(doc => doc.data().groupId);
        
        if (userGroupIds.length === 0) {
          setGroups([]);
          setIsLoadingGroups(false);
          return;
        }
        
        const groupsData: any[] = [];
        const groupsRef = collection(db, 'groups');
        
        for (const groupId of userGroupIds) {
          const groupQuery = query(groupsRef, where('id', '==', groupId));
          const groupSnapshot = await getDocs(groupQuery);
          
          if (!groupSnapshot.empty) {
            const groupDoc = groupSnapshot.docs[0];
            groupsData.push({
              id: groupDoc.data().id,
              name: groupDoc.data().name,
              description: groupDoc.data().description,
              createdAt: groupDoc.data().createdAt,
              creatorId: groupDoc.data().creatorId,
            });
          }
        }
        
        setGroups(groupsData);
      } catch (error) {
        console.error('Error fetching groups:', error);
        toast({
          title: 'Error',
          description: 'Failed to load groups. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingGroups(false);
      }
    };
    
    fetchGroups();
  }, [user, toast]);
  
  // Fetch flashcard collections
  useEffect(() => {
    if (!user) return;
    
    const fetchCollections = async () => {
      try {
        setIsLoadingCollections(true);
        const collectionsRef = collection(db, 'flashcard_collections');
        
        // Get all collections from user's groups
        if (groups.length === 0) {
          setCollections([]);
          setIsLoadingCollections(false);
          return;
        }
        
        const groupIds = groups.map(group => group.id);
        const q = query(
          collectionsRef, 
          where('groupId', 'in', groupIds),
          orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const collectionsData: FlashcardCollection[] = [];
        
        for (const doc of querySnapshot.docs) {
          const data = doc.data();
          
          // Get card count for this collection
          const cardsRef = collection(db, 'flashcards');
          const cardsQuery = query(cardsRef, where('collectionId', '==', doc.id));
          const cardsSnapshot = await getDocs(cardsQuery);
          
          collectionsData.push({
            id: doc.id,
            name: data.name,
            description: data.description || '',
            groupId: data.groupId,
            creatorId: data.creatorId,
            creatorName: data.creatorName || 'Unknown',
            cardCount: cardsSnapshot.size,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt || data.createdAt,
          });
        }
        
        setCollections(collectionsData);
      } catch (error) {
        console.error('Error fetching collections:', error);
        toast({
          title: 'Error',
          description: 'Failed to load flashcard collections. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingCollections(false);
      }
    };
    
    if (groups.length > 0) {
      fetchCollections();
    }
  }, [user, groups, toast]);
  
  // Fetch flashcards for a collection
  const fetchFlashcards = async (collectionId: string) => {
    try {
      setIsLoadingFlashcards(true);
      const flashcardsRef = collection(db, 'flashcards');
      const q = query(
        flashcardsRef, 
        where('collectionId', '==', collectionId),
        orderBy('createdAt', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const flashcardsData: Flashcard[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        flashcardsData.push({
          id: doc.id,
          question: data.question,
          answer: data.answer,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt || data.createdAt,
        });
      });
      
      setFlashcards(flashcardsData);
    } catch (error) {
      console.error('Error fetching flashcards:', error);
      toast({
        title: 'Error',
        description: 'Failed to load flashcards. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingFlashcards(false);
    }
  };
  
  // Select a collection
  const handleSelectCollection = (collection: FlashcardCollection) => {
    setSelectedCollection(collection);
    fetchFlashcards(collection.id);
    setActiveTab('cards');
  };
  
  // Create a new collection
  const handleCreateCollection = async (data: CreateCollectionFormValues) => {
    try {
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to create a collection.',
          variant: 'destructive',
        });
        return;
      }
      
      const now = new Date().toISOString();
      const newCollection = {
        name: data.name,
        description: data.description || '',
        groupId: parseInt(data.groupId),
        creatorId: user.id,
        creatorName: user.name,
        createdAt: now,
        updatedAt: now,
      };
      
      const docRef = await addDoc(collection(db, 'flashcard_collections'), newCollection);
      
      // Add to local state
      setCollections(prev => [{
        ...newCollection,
        id: docRef.id,
        cardCount: 0,
      } as FlashcardCollection, ...prev]);
      
      // Reset form and close dialog
      collectionForm.reset();
      setCreateCollectionDialogOpen(false);
      
      toast({
        title: 'Success',
        description: 'Flashcard collection created successfully.',
      });
      
      // Select the new collection
      const newCollectionWithId = {
        ...newCollection,
        id: docRef.id,
        cardCount: 0,
      } as FlashcardCollection;
      
      handleSelectCollection(newCollectionWithId);
    } catch (error) {
      console.error('Error creating collection:', error);
      toast({
        title: 'Error',
        description: 'Failed to create collection. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Create a new flashcard
  const handleCreateFlashcard = async (data: CreateFlashcardFormValues) => {
    try {
      if (!selectedCollection) {
        toast({
          title: 'Error',
          description: 'No collection selected.',
          variant: 'destructive',
        });
        return;
      }
      
      const now = new Date().toISOString();
      
      if (editMode.active && editMode.flashcard) {
        // Update existing flashcard
        const flashcardRef = doc(db, 'flashcards', editMode.flashcard.id);
        await updateDoc(flashcardRef, {
          question: data.question,
          answer: data.answer,
          updatedAt: now,
        });
        
        // Update in local state
        setFlashcards(prev => 
          prev.map(card => 
            card.id === editMode.flashcard!.id 
              ? { ...card, question: data.question, answer: data.answer, updatedAt: now } 
              : card
          )
        );
        
        toast({
          title: 'Success',
          description: 'Flashcard updated successfully.',
        });
      } else {
        // Create new flashcard
        const newFlashcard = {
          collectionId: selectedCollection.id,
          question: data.question,
          answer: data.answer,
          createdAt: now,
          updatedAt: now,
        };
        
        const docRef = await addDoc(collection(db, 'flashcards'), newFlashcard);
        
        // Add to local state
        setFlashcards(prev => [...prev, {
          id: docRef.id,
          question: data.question,
          answer: data.answer,
          createdAt: now,
          updatedAt: now,
        }]);
        
        // Update card count in collection
        setCollections(prev => 
          prev.map(col => 
            col.id === selectedCollection.id 
              ? { ...col, cardCount: col.cardCount + 1 } 
              : col
          )
        );
        
        // Update selected collection
        if (selectedCollection) {
          setSelectedCollection({
            ...selectedCollection,
            cardCount: selectedCollection.cardCount + 1
          });
        }
        
        toast({
          title: 'Success',
          description: 'Flashcard created successfully.',
        });
      }
      
      // Reset form and close dialog
      flashcardForm.reset();
      setCreateFlashcardDialogOpen(false);
      setEditMode({ active: false, flashcard: null });
    } catch (error) {
      console.error('Error with flashcard:', error);
      toast({
        title: 'Error',
        description: `Failed to ${editMode.active ? 'update' : 'create'} flashcard. Please try again.`,
        variant: 'destructive',
      });
    }
  };
  
  // Delete a flashcard
  const handleDeleteFlashcard = async (flashcardId: string) => {
    try {
      if (!selectedCollection) return;
      
      await deleteDoc(doc(db, 'flashcards', flashcardId));
      
      // Remove from local state
      setFlashcards(prev => prev.filter(card => card.id !== flashcardId));
      
      // Update card count in collection
      setCollections(prev => 
        prev.map(col => 
          col.id === selectedCollection.id 
            ? { ...col, cardCount: col.cardCount - 1 } 
            : col
        )
      );
      
      // Update selected collection
      if (selectedCollection) {
        setSelectedCollection({
          ...selectedCollection,
          cardCount: selectedCollection.cardCount - 1
        });
      }
      
      toast({
        title: 'Success',
        description: 'Flashcard deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete flashcard. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Delete a collection
  const handleDeleteCollection = async (collectionId: string) => {
    try {
      // First delete all flashcards in this collection
      const flashcardsRef = collection(db, 'flashcards');
      const q = query(flashcardsRef, where('collectionId', '==', collectionId));
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(document => 
        deleteDoc(doc(db, 'flashcards', document.id))
      );
      
      await Promise.all(deletePromises);
      
      // Then delete the collection
      await deleteDoc(doc(db, 'flashcard_collections', collectionId));
      
      // Remove from local state
      setCollections(prev => prev.filter(col => col.id !== collectionId));
      
      // If the deleted collection was selected, clear selection
      if (selectedCollection && selectedCollection.id === collectionId) {
        setSelectedCollection(null);
        setFlashcards([]);
        setActiveTab('collections');
      }
      
      toast({
        title: 'Success',
        description: 'Collection and its flashcards deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete collection. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Study mode controls
  const startStudyMode = () => {
    if (flashcards.length === 0) {
      toast({
        title: 'Cannot start study mode',
        description: 'This collection has no flashcards.',
        variant: 'destructive',
      });
      return;
    }
    
    setStudyMode(true);
    setCurrentCardIndex(0);
    setShowAnswer(false);
  };
  
  const stopStudyMode = () => {
    setStudyMode(false);
    setShowAnswer(false);
  };
  
  const nextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      // End of cards
      toast({
        title: 'End of cards',
        description: 'You have reviewed all cards in this collection.',
      });
    }
  };
  
  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      setShowAnswer(false);
    }
  };
  
  const shuffleCards = () => {
    // Fisher-Yates shuffle algorithm
    const shuffled = [...flashcards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setFlashcards(shuffled);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    
    toast({
      title: 'Cards shuffled',
      description: 'The order of flashcards has been randomized.',
    });
  };
  
  // Edit flashcard
  const handleEditFlashcard = (flashcard: Flashcard) => {
    setEditMode({ active: true, flashcard });
    flashcardForm.setValue('question', flashcard.question);
    flashcardForm.setValue('answer', flashcard.answer);
    setCreateFlashcardDialogOpen(true);
  };
  
  // If user is not logged in, show login prompt
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">StudySync</h1>
          <p className="mb-4">Please log in to access flashcards</p>
          <Button onClick={() => navigate('/auth')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar (Desktop) */}
        <Sidebar 
          userName={user.name} 
          userEmail={user.email} 
          userAvatar={user.avatar} 
          activeItem="flashcards" 
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header */}
          <header className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-neutral-dark">
                  {studyMode ? (
                    <div className="flex items-center">
                      <button 
                        onClick={stopStudyMode}
                        className="mr-2 text-neutral-dark hover:text-primary"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      Study Mode: {selectedCollection?.name}
                    </div>
                  ) : (
                    activeTab === 'collections' ? 'Flashcard Collections' : 
                    selectedCollection ? `Collection: ${selectedCollection.name}` : 'Flashcards'
                  )}
                </h1>
              </div>
              
              {/* Action buttons based on view */}
              {!studyMode && (
                <div>
                  {activeTab === 'collections' ? (
                    <Button onClick={() => setCreateCollectionDialogOpen(true)} size="sm">
                      <Plus className="mr-1 h-4 w-4" /> New Collection
                    </Button>
                  ) : selectedCollection ? (
                    <div className="flex space-x-2">
                      <Button onClick={startStudyMode} size="sm" variant="secondary">
                        <Play className="mr-1 h-4 w-4" /> Study
                      </Button>
                      <Button onClick={() => setCreateFlashcardDialogOpen(true)} size="sm">
                        <Plus className="mr-1 h-4 w-4" /> Add Card
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </header>
          
          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-4 bg-neutral-light">
            {/* Study Mode View */}
            {studyMode && selectedCollection && flashcards.length > 0 ? (
              <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex space-x-1">
                    <Button 
                      onClick={prevCard} 
                      disabled={currentCardIndex === 0}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                      onClick={nextCard}
                      disabled={currentCardIndex === flashcards.length - 1}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="text-sm text-neutral-dark">
                    Card {currentCardIndex + 1} of {flashcards.length}
                  </div>
                  
                  <div className="flex space-x-1">
                    <Button onClick={shuffleCards} variant="outline" size="sm">
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button onClick={stopStudyMode} variant="outline" size="sm">
                      Exit
                    </Button>
                  </div>
                </div>
                
                <Card className="mb-6">
                  <CardContent className="p-0">
                    <div className="p-6 min-h-[300px] flex flex-col justify-center items-center">
                      <div className="text-center w-full">
                        <p className="text-gray-500 text-sm mb-2">Question</p>
                        <p className="text-xl font-semibold mb-8">{flashcards[currentCardIndex].question}</p>
                        
                        {showAnswer ? (
                          <>
                            <div className="border-t border-gray-200 w-full my-4"></div>
                            <p className="text-gray-500 text-sm mb-2">Answer</p>
                            <p className="text-xl">{flashcards[currentCardIndex].answer}</p>
                          </>
                        ) : (
                          <Button 
                            onClick={() => setShowAnswer(true)}
                            variant="secondary"
                            className="mt-4"
                          >
                            Show Answer
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t p-4">
                    {showAnswer && (
                      <div className="w-full flex justify-center space-x-2">
                        <Button onClick={nextCard} className="px-8">
                          {currentCardIndex === flashcards.length - 1 ? 'Finish' : 'Next Card'}
                        </Button>
                      </div>
                    )}
                  </CardFooter>
                </Card>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto">
                {/* Navigation tabs when not in study mode */}
                {!studyMode && selectedCollection && (
                  <div className="mb-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="w-full">
                        <TabsTrigger value="collections" className="flex-1">
                          <BookCopy className="mr-2 h-4 w-4" /> Collections
                        </TabsTrigger>
                        <TabsTrigger value="cards" className="flex-1">
                          <BookOpen className="mr-2 h-4 w-4" /> Cards
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                )}
                
                {/* Collections View */}
                {activeTab === 'collections' && (
                  <>
                    {isLoadingCollections ? (
                      <div className="space-y-4">
                        <Skeleton className="h-36 w-full" />
                        <Skeleton className="h-36 w-full" />
                        <Skeleton className="h-36 w-full" />
                      </div>
                    ) : collections.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {collections.map((collection) => (
                          <Card 
                            key={collection.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => handleSelectCollection(collection)}
                          >
                            <CardHeader className="pb-2">
                              <CardTitle className="flex justify-between items-start">
                                <div className="truncate">{collection.name}</div>
                                <div className="flex">
                                  {collection.creatorId === user.id && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteCollection(collection.id);
                                      }}
                                      className="text-neutral-dark/70 hover:text-red-500 ml-2"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </CardTitle>
                              <CardDescription>
                                {collection.description || 'No description'}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center justify-between text-sm text-neutral-dark/70">
                                <span>{collection.cardCount} {collection.cardCount === 1 ? 'card' : 'cards'}</span>
                                <span>Created by {collection.creatorName}</span>
                              </div>
                            </CardContent>
                            <CardFooter className="border-t pt-2 pb-2">
                              <Button 
                                variant="secondary" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectCollection(collection);
                                  startStudyMode();
                                }}
                                className="w-full"
                                disabled={collection.cardCount === 0}
                              >
                                <Play className="mr-2 h-4 w-4" /> Study
                              </Button>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <BookOpen className="h-12 w-12 mx-auto text-neutral-dark/30 mb-2" />
                        <h3 className="text-lg font-medium">No flashcard collections</h3>
                        <p className="text-neutral-dark/70 mb-4">
                          Create your first collection to start studying
                        </p>
                        <Button onClick={() => setCreateCollectionDialogOpen(true)}>
                          <Plus className="mr-2 h-4 w-4" /> Create Collection
                        </Button>
                      </div>
                    )}
                  </>
                )}
                
                {/* Cards View */}
                {activeTab === 'cards' && selectedCollection && (
                  <>
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle>{selectedCollection.name}</CardTitle>
                        <CardDescription>{selectedCollection.description || 'No description'}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-neutral-dark/70 flex justify-between">
                          <span>Created by {selectedCollection.creatorName}</span>
                          <span>{selectedCollection.cardCount} {selectedCollection.cardCount === 1 ? 'card' : 'cards'}</span>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {isLoadingFlashcards ? (
                      <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : flashcards.length > 0 ? (
                      <div className="space-y-3">
                        {flashcards.map((flashcard, index) => (
                          <Card key={flashcard.id}>
                            <CardContent className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm font-medium text-neutral-dark/70 mb-1">Question</p>
                                  <p>{flashcard.question}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-neutral-dark/70 mb-1">Answer</p>
                                  <p>{flashcard.answer}</p>
                                </div>
                              </div>
                              
                              <div className="flex justify-end space-x-2 mt-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleEditFlashcard(flashcard)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDeleteFlashcard(flashcard.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <BookOpen className="h-12 w-12 mx-auto text-neutral-dark/30 mb-2" />
                        <h3 className="text-lg font-medium">No flashcards in this collection</h3>
                        <p className="text-neutral-dark/70 mb-4">
                          Add your first flashcard to start studying
                        </p>
                        <Button onClick={() => setCreateFlashcardDialogOpen(true)}>
                          <Plus className="mr-2 h-4 w-4" /> Add Flashcard
                        </Button>
                      </div>
                    )}
                  </>
                )}
                
                {/* Create Collection Dialog */}
                <Dialog open={createCollectionDialogOpen} onOpenChange={setCreateCollectionDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Flashcard Collection</DialogTitle>
                      <DialogDescription>
                        Create a new collection of flashcards for studying.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={collectionForm.handleSubmit(handleCreateCollection)}>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="name">Collection Name</Label>
                          <Input
                            id="name"
                            placeholder="Enter collection name"
                            {...collectionForm.register("name")}
                          />
                          {collectionForm.formState.errors.name && (
                            <p className="text-red-500 text-sm">
                              {collectionForm.formState.errors.name.message}
                            </p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="description">Description (Optional)</Label>
                          <Textarea
                            id="description"
                            placeholder="Enter a description for this collection"
                            rows={3}
                            {...collectionForm.register("description")}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="groupId">Group</Label>
                          <Select 
                            onValueChange={(value) => collectionForm.setValue("groupId", value)}
                            defaultValue={collectionForm.getValues("groupId")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a group" />
                            </SelectTrigger>
                            <SelectContent>
                              {isLoadingGroups ? (
                                <SelectItem value="loading" disabled>Loading groups...</SelectItem>
                              ) : groups.length > 0 ? (
                                groups.map((group) => (
                                  <SelectItem key={group.id} value={group.id.toString()}>
                                    {group.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>No groups available</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          {collectionForm.formState.errors.groupId && (
                            <p className="text-red-500 text-sm">
                              {collectionForm.formState.errors.groupId.message}
                            </p>
                          )}
                          {groups.length === 0 && !isLoadingGroups && (
                            <p className="text-amber-500 text-sm">
                              You need to be a member of at least one group to create flashcards.
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <DialogFooter className="mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateCollectionDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          disabled={groups.length === 0 || isLoadingGroups}
                        >
                          Create Collection
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                
                {/* Create/Edit Flashcard Dialog */}
                <Dialog open={createFlashcardDialogOpen} onOpenChange={setCreateFlashcardDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editMode.active ? 'Edit Flashcard' : 'Create Flashcard'}
                      </DialogTitle>
                      <DialogDescription>
                        {editMode.active 
                          ? 'Update this flashcard with new information.'
                          : 'Add a new flashcard to this collection.'
                        }
                      </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={flashcardForm.handleSubmit(handleCreateFlashcard)}>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="question">Question</Label>
                          <Textarea
                            id="question"
                            placeholder="Enter the question"
                            rows={3}
                            {...flashcardForm.register("question")}
                          />
                          {flashcardForm.formState.errors.question && (
                            <p className="text-red-500 text-sm">
                              {flashcardForm.formState.errors.question.message}
                            </p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="answer">Answer</Label>
                          <Textarea
                            id="answer"
                            placeholder="Enter the answer"
                            rows={3}
                            {...flashcardForm.register("answer")}
                          />
                          {flashcardForm.formState.errors.answer && (
                            <p className="text-red-500 text-sm">
                              {flashcardForm.formState.errors.answer.message}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <DialogFooter className="mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setCreateFlashcardDialogOpen(false);
                            if (editMode.active) {
                              setEditMode({ active: false, flashcard: null });
                              flashcardForm.reset();
                            }
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editMode.active ? 'Update Flashcard' : 'Add Flashcard'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </main>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      <MobileNav activeItem="flashcards" />
    </div>
  );
}