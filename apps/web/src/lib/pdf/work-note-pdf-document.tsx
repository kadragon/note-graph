import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Todo, WorkNoteWithStats } from '@web/types/api';

// Register Korean font
Font.register({
  family: 'NotoSansKR',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.0.0/files/noto-sans-kr-korean-400-normal.woff',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.0.0/files/noto-sans-kr-korean-700-normal.woff',
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'NotoSansKR',
    fontSize: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 16,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
    color: '#374151',
  },
  categoryBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 9,
    color: '#4b5563',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  label: {
    color: '#6b7280',
    marginRight: 8,
  },
  personName: {
    fontWeight: 700,
  },
  personDept: {
    color: '#6b7280',
  },
  content: {
    lineHeight: 1.6,
    color: '#1f2937',
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  todoStatus: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  todoStatusCompleted: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  todoTitle: {
    flex: 1,
  },
  todoTitleCompleted: {
    textDecoration: 'line-through',
    color: '#9ca3af',
  },
  dateText: {
    fontSize: 9,
    color: '#6b7280',
  },
});

interface WorkNotePDFDocumentProps {
  workNote: WorkNoteWithStats;
  todos: Todo[];
}

export function WorkNotePDFDocument({ workNote, todos }: WorkNotePDFDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>{workNote.title}</Text>

        {/* Categories */}
        {workNote.categories && workNote.categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>업무 구분</Text>
            <View style={styles.row}>
              {workNote.categories.map((category) => (
                <View key={category.categoryId} style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{category.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Assignees */}
        {workNote.persons && workNote.persons.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>담당자</Text>
            {workNote.persons.map((person) => (
              <View key={person.personId} style={styles.row}>
                <Text style={styles.personName}>{person.personName}</Text>
                {person.currentDept && (
                  <Text style={styles.personDept}> ({person.currentDept})</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Dates */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>생성일:</Text>
            <Text style={styles.dateText}>{workNote.createdAt}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>수정일:</Text>
            <Text style={styles.dateText}>{workNote.updatedAt}</Text>
          </View>
        </View>

        {/* Content */}
        {workNote.content && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>내용</Text>
            <Text style={styles.content}>{workNote.content}</Text>
          </View>
        )}

        {/* Todos */}
        {todos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>할일 목록</Text>
            {todos.map((todo) => {
              const isCompleted = todo.status === '완료';
              return (
                <View key={todo.id} style={styles.todoItem}>
                  <View
                    style={
                      isCompleted
                        ? [styles.todoStatus, styles.todoStatusCompleted]
                        : styles.todoStatus
                    }
                  />
                  <Text
                    style={
                      isCompleted ? [styles.todoTitle, styles.todoTitleCompleted] : styles.todoTitle
                    }
                  >
                    {todo.title}
                  </Text>
                  {todo.dueDate && <Text style={styles.dateText}>{todo.dueDate}</Text>}
                </View>
              );
            })}
          </View>
        )}
      </Page>
    </Document>
  );
}
