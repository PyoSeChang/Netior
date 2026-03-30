# Heading 1

## Heading 2

### Heading 3

#### Heading 4

##### Heading 5

###### Heading 6

---

## Inline Formatting

This is **bold text** and this is *italic text* and this is ***bold italic***.

This has ~~strikethrough~~ text and `inline code` in it.

You can also use __underscores for bold__ and _underscores for italic_.

---

## Links & Images

Here is a [link to Google](https://google.com) in a sentence.

Here is an image: ![Alt text](https://example.com/image.png)

---

## Lists

### Unordered List

- First item
- Second item
- Third item with **bold**

### Ordered List

1. First ordered
2. Second ordered
3. Third ordered

### Task List

- [ ] Incomplete task
- [x] Completed task
- [ ] Another incomplete with `code`
- [x] Done with **bold** text

---

## Blockquote

> This is a blockquote.
> It can span multiple lines.

> Nested blockquote with **bold** and *italic*.

---

## Code Blocks

```javascript
function hello() {
  console.log("Hello, World!");
  return 42;
}
```

```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
```

```
Plain code block without language
Just some code here
```

---

## Table

| Name | Type | Description |
|------|------|-------------|
| id | number | Primary key |
| title | string | Display name |
| active | boolean | Is active? |

---

## Mixed Formatting

A paragraph with **bold**, *italic*, `code`, ~~strikethrough~~, and a [link](https://example.com) all together.

> A blockquote with **bold text** and a [link](https://example.com) inside.

- List with **bold** and *italic* and `code` items
- Another item with a [link](https://example.com)

---

## Edge Cases

Empty lines above and below.

**Bold at start** of line.

End of line **bold**.

*Single word italic*

`single code`

A very long paragraph to test line wrapping behavior. This paragraph contains enough text to wrap across multiple lines in the editor, ensuring that the live preview handles long content gracefully without breaking the layout or introducing visual artifacts.
